#!/usr/bin/env python3
"""
Claude Code Gateway Client
Polls the MCP gateway server for commands and executes them via HTTP bridge.
"""

import json
import subprocess
import time
import sys
import os
import requests
from pathlib import Path

# Gateway HTTP bridge endpoint
GATEWAY_URL = "http://localhost:3000"

def get_next_command():
    """Poll the gateway for the next pending command."""
    try:
        response = requests.get(f"{GATEWAY_URL}/next-command", timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error getting next command: {response.status_code}")
            return None
    except requests.RequestException as e:
        print(f"Connection error: {e}")
        return None

def reset_stuck_commands():
    """Reset commands stuck in 'running' state for more than 5 minutes."""
    try:
        response = requests.get(f"{GATEWAY_URL}/queue", timeout=5)
        if response.status_code == 200:
            commands = response.json()
            now = time.time() * 1000  # Convert to milliseconds
            five_minutes = 5 * 60 * 1000
            
            for cmd in commands:
                if cmd.get('status') == 'running':
                    age = now - cmd.get('timestamp', now)
                    if age > five_minutes:
                        print(f"\nResetting stuck command {cmd['id']} (age: {age/1000:.0f}s)")
                        # Would need a reset endpoint, for now just log it
    except Exception as e:
        pass  # Silent failure, this is just cleanup

def submit_result(command_id, status, result=None, error=None):
    """Submit command execution result back to gateway."""
    try:
        data = {
            "id": command_id,
            "status": status,
            "result": result or "",
            "error": error or ""
        }
        response = requests.post(f"{GATEWAY_URL}/submit-result", json=data, timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error submitting result: {response.status_code}")
            return None
    except requests.RequestException as e:
        print(f"Connection error submitting result: {e}")
        return None

def execute_command(command):
    """Execute a command and return the result."""
    cmd_type = command.get('type')
    cmd = command.get('command')
    args = command.get('args', {})
    
    try:
        if cmd_type == 'shell':
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=args.get('cwd', os.getcwd())
            )
            return {
                'status': 'completed',
                'result': f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}\nreturn_code: {result.returncode}"
            }
            
        elif cmd_type == 'file_read':
            path = Path(cmd)
            if path.exists():
                content = path.read_text()
                return {
                    'status': 'completed',
                    'result': content
                }
            else:
                return {
                    'status': 'error',
                    'error': f"File not found: {cmd}"
                }
                
        elif cmd_type == 'file_write':
            path = Path(cmd)
            content = args.get('content', '')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            return {
                'status': 'completed',
                'result': f"Wrote {len(content)} bytes to {cmd}"
            }
            
        elif cmd_type == 'check':
            # Just a health check
            return {
                'status': 'completed',
                'result': f"Claude Code client is running. Working directory: {os.getcwd()}"
            }
            
        else:
            return {
                'status': 'error',
                'error': f"Unknown command type: {cmd_type}"
            }
            
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }

def main():
    print("Claude Code Gateway Client started")
    print(f"Connecting to gateway at {GATEWAY_URL}")
    print("Polling for commands...")
    
    # Test connection
    try:
        response = requests.get(f"{GATEWAY_URL}/queue", timeout=2)
        if response.status_code == 200:
            print("✓ Connected to gateway HTTP bridge")
        else:
            print(f"⚠ Gateway returned status {response.status_code}")
    except requests.RequestException as e:
        print(f"⚠ Cannot connect to gateway: {e}")
        print("Make sure the gateway server is running with HTTP bridge on port 3000")
    
    # Reset stuck commands every 50 iterations (100 seconds)
    iteration = 0
    
    while True:
        try:
            # Periodically reset stuck commands
            iteration += 1
            if iteration % 50 == 0:
                reset_stuck_commands()
            
            # Get next command
            command = get_next_command()
            
            if command:
                if 'message' in command:
                    # No pending commands
                    print(".", end="", flush=True)
                else:
                    print(f"\n✓ Received command: {command['id']} - {command['type']}: {command['command'][:50]}...")
                    
                    # Execute the command
                    result = execute_command(command)
                    
                    # Submit result back
                    submit_response = submit_result(
                        command['id'],
                        result['status'],
                        result.get('result'),
                        result.get('error')
                    )
                    
                    if submit_response:
                        print(f"✓ Result submitted: {submit_response.get('message', 'OK')}")
                    else:
                        print("⚠ Failed to submit result")
            
            # Poll every 2 seconds
            time.sleep(2)
            
        except KeyboardInterrupt:
            print("\nShutting down...")
            break
        except Exception as e:
            print(f"Error in main loop: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()

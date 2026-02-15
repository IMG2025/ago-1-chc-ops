"""
CoreIdentity Python SDK
Client library for Digital Labor Network
"""

import requests
from typing import Dict, Any, Optional
from datetime import datetime

class CoreIdentityClient:
    """Client for CoreIdentity Digital Labor API"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.coreidentity.ai"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def submit_task(
        self,
        task_type: str,
        payload: Dict[str, Any],
        priority: str = "normal"
    ) -> Dict[str, Any]:
        """Submit a task for execution"""
        response = requests.post(
            f"{self.base_url}/v1/tasks",
            json={
                "taskType": task_type,
                "payload": payload,
                "priority": priority
            },
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def get_task(self, task_id: str) -> Dict[str, Any]:
        """Get task status and results"""
        response = requests.get(
            f"{self.base_url}/v1/tasks/{task_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def wait_for_completion(
        self,
        task_id: str,
        timeout: int = 300,
        poll_interval: int = 2
    ) -> Dict[str, Any]:
        """Wait for task to complete"""
        import time
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            task = self.get_task(task_id)
            
            if task['status'] in ['completed', 'failed']:
                return task
            
            time.sleep(poll_interval)
        
        raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
    
    def get_usage(self) -> Dict[str, Any]:
        """Get usage statistics"""
        response = requests.get(
            f"{self.base_url}/v1/usage",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Example usage
if __name__ == "__main__":
    client = CoreIdentityClient(api_key="your_api_key")
    
    # Submit task
    task = client.submit_task(
        task_type="analyze_data",
        payload={"data": [1, 2, 3, 4, 5]},
        priority="high"
    )
    
    print(f"Task submitted: {task['taskId']}")
    
    # Wait for completion
    result = client.wait_for_completion(task['taskId'])
    print(f"Task completed: {result}")

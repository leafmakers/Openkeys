# Keyboard City API Documentation

## Overview

The Keyboard City API provides endpoints for text processing and manipulation to enhance the keyboard visualization experience. The API is built on Supabase Edge Functions and follows RESTful principles.

## Base URL

```
https://your-project-id.supabase.co/functions/v1
```

## Authentication

All API endpoints require authentication using Supabase's authentication system:

```http
Authorization: Bearer <supabase_anon_key>
```

## Content Type

All requests should include the appropriate content type header:

```http
Content-Type: application/json
```

## Rate Limiting

- **Requests per minute**: 60
- **Requests per hour**: 1000
- **Burst limit**: 10 requests per second

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request - Invalid request format |
| 401  | Unauthorized - Missing or invalid authentication |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Endpoint or resource not found |
| 422  | Unprocessable Entity - Valid format but semantic errors |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error |
| 503  | Service Unavailable - Temporary server issues |

## Endpoints

### Text Processing

#### POST /openai

Transforms input text using AI to create poetic, design-focused content suitable for keyboard visualization.

**Request Body:**
```json
{
  "text": "string (optional)"
}
```

**Parameters:**
- `text` (string, optional): Input text to transform. If empty or omitted, generates inspirational design quote.

**Response:**
```json
{
  "text": "Transformed poetic text suitable for visualization"
}
```

**Example Request:**
```bash
curl -X POST \
  'https://your-project-id.supabase.co/functions/v1/openai' \
  -H 'Authorization: Bearer your-supabase-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Design is thinking made visual"
  }'
```

**Example Response:**
```json
{
  "text": "Design breathes life into silent thoughts, transforming whispers into visual symphonies."
}
```

**Error Responses:**

*400 Bad Request:*
```json
{
  "error": "Invalid request body",
  "details": "Request body must include a 'text' field"
}
```

*401 Unauthorized:*
```json
{
  "error": "OpenAI API key is not configured. Please check your Supabase Edge Function secrets.",
  "details": "The OPENAI_API_KEY environment variable is missing."
}
```

*500 Internal Server Error:*
```json
{
  "error": "Failed to generate valid text after 3 attempts",
  "details": "AI service temporarily unavailable"
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
class KeyboardCityAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(projectId: string, apiKey: string) {
    this.baseUrl = `https://${projectId}.supabase.co/functions/v1`;
    this.apiKey = apiKey;
  }

  async transformText(text?: string): Promise<{ text: string }> {
    const response = await fetch(`${this.baseUrl}/openai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text || '' })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }
}

// Usage
const api = new KeyboardCityAPI('your-project-id', 'your-anon-key');
const result = await api.transformText('Hello world');
console.log(result.text);
```

### Python

```python
import requests
import json

class KeyboardCityAPI:
    def __init__(self, project_id: str, api_key: str):
        self.base_url = f"https://{project_id}.supabase.co/functions/v1"
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def transform_text(self, text: str = '') -> dict:
        response = requests.post(
            f"{self.base_url}/openai",
            headers=self.headers,
            json={'text': text}
        )
        
        if response.status_code != 200:
            raise Exception(f"API Error: {response.json().get('error', 'Unknown error')}")
        
        return response.json()

# Usage
api = KeyboardCityAPI('your-project-id', 'your-anon-key')
result = api.transform_text('Hello world')
print(result['text'])
```

## Response Time Expectations

| Endpoint | Average Response Time | Timeout |
|----------|----------------------|---------|
| POST /openai | 2-5 seconds | 30 seconds |

## Changelog

### v1.0.0 (Current)
- Initial API release
- Text transformation endpoint
- Basic error handling
- Authentication support

## Support

For API support and questions:
- Create an issue in the project repository
- Check the troubleshooting section below

## Troubleshooting

### Common Issues

**"OpenAI API key is not configured"**
- Ensure the `OPENAI_API_KEY` is set in your Supabase Edge Function secrets
- Verify the key is valid and has sufficient credits

**"Network error. Please check your connection"**
- Check internet connectivity
- Verify the Supabase project URL is correct
- Ensure CORS is properly configured

**Rate limit exceeded (429)**
- Implement exponential backoff in your client
- Consider upgrading your Supabase plan for higher limits
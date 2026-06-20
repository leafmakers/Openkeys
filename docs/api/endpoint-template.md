# API Endpoint Template

Use this template when adding new endpoints to maintain consistency across the API.

## Endpoint Name

Brief description of what this endpoint does.

### HTTP Method and Path

```
METHOD /endpoint-path
```

### Authentication

- [ ] Required
- [ ] Optional
- [ ] Public

### Request

#### Headers
```http
Content-Type: application/json
Authorization: Bearer <token> (if required)
```

#### Parameters

| Parameter | Type | Required | Description | Default | Example |
|-----------|------|----------|-------------|---------|---------|
| param1 | string | Yes | Description of param1 | - | "example" |
| param2 | number | No | Description of param2 | 10 | 25 |

#### Request Body Schema

```json
{
  "field1": "string",
  "field2": 123,
  "field3": {
    "nested": "object"
  }
}
```

#### Validation Rules

- `field1`: Must be non-empty string, max 100 characters
- `field2`: Must be positive integer between 1-1000
- `field3.nested`: Optional, valid email format if provided

### Response

#### Success Response (200/201)

```json
{
  "id": "uuid",
  "field1": "string",
  "field2": 123,
  "metadata": {
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| field1 | string | Description of field1 |
| field2 | number | Description of field2 |
| metadata | object | System metadata |

### Error Responses

#### 400 Bad Request
```json
{
  "error": "Invalid request format",
  "details": "Specific validation error details",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "details": "Valid API key must be provided",
  "code": "UNAUTHORIZED",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 404 Not Found
```json
{
  "error": "Resource not found",
  "details": "The requested resource does not exist",
  "code": "NOT_FOUND",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "An unexpected error occurred",
  "code": "INTERNAL_ERROR",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Rate Limiting

- Requests per minute: X
- Requests per hour: Y
- Burst limit: Z requests per second

### Examples

#### cURL Example

```bash
curl -X METHOD \
  'https://your-project-id.supabase.co/functions/v1/endpoint-path' \
  -H 'Authorization: Bearer your-api-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "field1": "example",
    "field2": 123
  }'
```

#### JavaScript Example

```javascript
const response = await fetch('https://your-project-id.supabase.co/functions/v1/endpoint-path', {
  method: 'METHOD',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    field1: 'example',
    field2: 123
  })
});

const data = await response.json();
console.log(data);
```

#### Python Example

```python
import requests

response = requests.method(
    'https://your-project-id.supabase.co/functions/v1/endpoint-path',
    headers={
        'Authorization': 'Bearer your-api-key',
        'Content-Type': 'application/json'
    },
    json={
        'field1': 'example',
        'field2': 123
    }
)

data = response.json()
print(data)
```

### Performance

- Average response time: X ms
- 95th percentile: Y ms
- Timeout: Z seconds

### Notes

- Any additional implementation notes
- Known limitations
- Related endpoints
- Migration information (if applicable)

### OpenAPI Schema Addition

```yaml
  /endpoint-path:
    method:
      summary: Brief description
      description: Detailed description
      operationId: operationName
      tags:
        - Tag Name
      requestBody:
        required: true/false
        content:
          application/json:
            schema:
              # Schema definition
      responses:
        '200':
          description: Success response
          content:
            application/json:
              schema:
                # Response schema
```

## Checklist for New Endpoints

- [ ] Endpoint follows RESTful conventions
- [ ] Authentication requirements defined
- [ ] Input validation implemented
- [ ] Error handling covers all scenarios
- [ ] Response format is consistent
- [ ] Rate limiting applied
- [ ] Documentation is complete
- [ ] OpenAPI schema updated
- [ ] Examples provided for multiple languages
- [ ] Tests written (unit and integration)
- [ ] Performance benchmarks established
- [ ] Monitoring/logging configured
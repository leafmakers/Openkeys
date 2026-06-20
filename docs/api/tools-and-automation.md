# API Documentation Tools and Automation

This document outlines recommended tools and practices for automatically generating and maintaining API documentation.

## Recommended Tools

### 1. OpenAPI/Swagger Tools

#### **Swagger UI** ⭐ Recommended
- **Purpose**: Interactive API documentation
- **Pros**: Industry standard, great UI, interactive examples
- **Setup**: 
  ```bash
  npm install swagger-ui-express
  ```
- **Implementation**: Host at `/api-docs` endpoint
- **Cost**: Free

#### **Redoc**
- **Purpose**: Clean, responsive API documentation
- **Pros**: Better mobile experience, cleaner design
- **Setup**:
  ```bash
  npm install redoc redoc-cli
  ```
- **Cost**: Free

#### **Stoplight Studio**
- **Purpose**: Visual API design and documentation
- **Pros**: Visual editor, mock servers, collaboration features
- **Cost**: Free tier available, paid for teams

### 2. Automatic Documentation Generation

#### **@apidevtools/swagger-jsdoc** ⭐ Recommended for JSDoc approach
- **Purpose**: Generate OpenAPI from JSDoc comments
- **Setup**:
  ```bash
  npm install @apidevtools/swagger-jsdoc swagger-ui-express
  ```
- **Usage**: Add JSDoc comments to your Supabase Edge Functions

Example implementation:
```typescript
// supabase/functions/openai/index.ts

/**
 * @swagger
 * /openai:
 *   post:
 *     summary: Transform text with AI
 *     description: Transforms input text using AI to create poetic, design-focused content
 *     tags: [Text Processing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 description: Input text to transform
 *     responses:
 *       200:
 *         description: Successfully transformed text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 */
```

#### **TypeDoc** (for TypeScript projects)
- **Purpose**: Generate documentation from TypeScript comments
- **Setup**:
  ```bash
  npm install typedoc
  ```

### 3. Documentation Hosting

#### **GitHub Pages** ⭐ Recommended
- **Pros**: Free, integrates with repo, automatic deployments
- **Setup**: Enable in repository settings
- **Use case**: Perfect for open source projects

#### **Netlify**
- **Pros**: Easy deployment, preview deployments, forms
- **Cost**: Free tier generous

#### **GitBook**
- **Pros**: Beautiful documentation, collaboration features
- **Cost**: Free for open source

## Implementation Strategy

### Phase 1: Basic Setup (Week 1)
```bash
# Install dependencies
npm install swagger-ui-express @apidevtools/swagger-jsdoc

# Create documentation structure
mkdir -p docs/api
```

### Phase 2: Automation (Week 2)
1. Set up GitHub Actions for automatic documentation updates
2. Implement JSDoc comments in existing functions
3. Configure Swagger UI endpoint

### Phase 3: Advanced Features (Week 3)
1. Add response examples
2. Implement API testing in documentation
3. Set up monitoring and analytics

## GitHub Actions Workflow

Create `.github/workflows/docs.yml`:

```yaml
name: Generate API Documentation

on:
  push:
    branches: [main]
    paths: 
      - 'supabase/functions/**'
      - 'docs/api/**'
  pull_request:
    branches: [main]

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Generate OpenAPI spec
      run: npm run generate-docs
    
    - name: Build documentation site
      run: npm run build-docs
    
    - name: Deploy to GitHub Pages
      if: github.ref == 'refs/heads/main'
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./docs-build
```

## Package.json Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "generate-docs": "swagger-jsdoc -d swagger.config.js supabase/functions/**/*.ts -o docs/api/openapi.json",
    "serve-docs": "swagger-ui-serve docs/api/openapi.yaml",
    "build-docs": "redoc-cli build docs/api/openapi.yaml --output docs-build/index.html",
    "validate-docs": "swagger-codegen validate -i docs/api/openapi.yaml"
  }
}
```

## Swagger Configuration

Create `swagger.config.js`:

```javascript
module.exports = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Keyboard City API',
      version: '1.0.0',
      description: 'API for Keyboard City text processing and visualization',
    },
    servers: [
      {
        url: 'https://your-project-id.supabase.co/functions/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    security: [{
      BearerAuth: []
    }],
  },
  apis: ['./supabase/functions/**/*.ts'],
};
```

## Testing Integration

### **Postman** ⭐ Recommended
- Import OpenAPI spec for automatic test generation
- Set up automated testing with Newman
- Share collections with team

### **Insomnia**
- Good alternative to Postman
- Clean interface
- Plugin ecosystem

### **REST Client** (VS Code extension)
- Test APIs directly in VS Code
- Version control test files
- Great for development workflow

## Monitoring and Analytics

### Documentation Analytics
```javascript
// Add to documentation pages
gtag('config', 'GA_MEASUREMENT_ID', {
  custom_map: {
    'custom_parameter_1': 'api_endpoint',
    'custom_parameter_2': 'documentation_section'
  }
});
```

### API Usage Tracking
- Implement request logging in Supabase Edge Functions
- Track popular endpoints
- Monitor error rates
- User feedback collection

## Best Practices

### 1. Documentation as Code
- Store documentation in version control
- Review documentation changes in PRs
- Automate documentation updates

### 2. Keep It Current
- Link documentation updates to code changes
- Use automation to prevent drift
- Regular documentation audits

### 3. User-Focused Content
- Include realistic examples
- Provide troubleshooting guides
- Add getting started tutorials

### 4. Interactive Examples
- Use Swagger UI's "Try it out" feature
- Provide working code samples
- Include common use cases

## Implementation Checklist

- [ ] Choose documentation tool (Swagger UI recommended)
- [ ] Set up OpenAPI specification file
- [ ] Configure automated generation
- [ ] Set up hosting (GitHub Pages recommended)
- [ ] Add JSDoc comments to existing functions
- [ ] Create GitHub Actions workflow
- [ ] Set up testing integration
- [ ] Add monitoring and analytics
- [ ] Create contribution guidelines for documentation
- [ ] Set up regular review process

## Cost Breakdown

| Tool | Cost | Notes |
|------|------|-------|
| Swagger UI | Free | Open source |
| GitHub Pages | Free | Included with GitHub |
| GitHub Actions | Free | 2000 minutes/month free |
| Postman | $12/user/month | For team features |
| Stoplight | $24/user/month | For advanced features |

**Recommended Budget**: $0-50/month depending on team size and advanced features needed.
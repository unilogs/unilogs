# Server Documentation

This directory contains the Express server for the application.

## Development

To start the development server with hot-reloading:

```bash
npm run server
```

The server will be available at `http://localhost:3000`

## Available Scripts

- `npm run server` - Start the development server with hot-reloading
- `npm run build:server` - Build the server for production
- `npm start` - Start the production server (after building)

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/example` - Example API endpoint

## Environment Variables

- `PORT` - Port to run the server on (default: 3000)
- `NODE_ENV` - Environment (development/production)

# Azure Resource Metadata Viewer

A modern React application for viewing and managing Azure resources with enhanced authentication and user experience.

## Features

- **🔐 Microsoft Authentication**: Secure sign-in using MSAL (Microsoft Authentication Library)
- **📊 Azure Resource Management**: Query and display Azure resources with detailed metadata
- **👥 User Management**: View resource ownership and role assignments
- **🏷️ Tag Management**: Comprehensive tag display and organization
- **🎨 Modern UI**: Beautiful Bootstrap-based interface with responsive design
- **⚡ Real-time Data**: Live Azure resource queries with loading states

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: React Bootstrap + Bootstrap 5
- **Authentication**: Microsoft MSAL (Microsoft Authentication Library)
- **Azure APIs**: Azure Resource Manager (ARM) + Microsoft Graph
- **Styling**: CSS with Bootstrap components

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Azure subscription
- Azure AD app registration with appropriate permissions

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_CLIENT_ID=your-client-id
```

### Installation

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

## Architecture

### Components

- **PageLayout**: Main navigation and layout structure
- **Dashboard**: Azure resource query interface and results display
- **SignInButton**: Authentication entry point with popup/redirect options
- **SignOutButton**: Secure logout with multiple methods
- **UserProfile**: Authenticated user information display

### Authentication Flow

1. User clicks "Sign In" → MSAL popup/redirect authentication
2. Acquire tokens for Azure ARM and Graph APIs
3. Query Azure resources and role assignments
4. Display results with enhanced UI components

### Azure Integration

- **ARM API**: Resource listing and metadata retrieval
- **Graph API**: User principal resolution for ownership display
- **Role-based Access Control**: Owner and contributor identification

## Features in Detail

### Resource Display
- Resource name, type, and location
- Resource group association
- Owner and contributor information
- Comprehensive tag visualization
- Responsive table layout

### User Experience
- Professional navigation bar
- Loading states and error handling
- Responsive design for all devices
- Intuitive form controls
- Clear visual hierarchy

## Contributing

This project uses modern React patterns and TypeScript for type safety. All components are functional with hooks, and the UI follows Bootstrap design principles.

## License

Private project - All rights reserved.

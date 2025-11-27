# GSH - Household Management App

A comprehensive household management application built with Firebase, supporting shopping lists, tasks, notes, and reminders with multi-user collaboration.

## Features

- **Shopping Lists**: Create and manage shopping lists with categories and item tracking
- **Tasks**: Organize tasks with timelines, categories, and responsibility assignment
- **Notes**: Create and organize notes with categories and rich formatting
- **Reminders**: Set time-based reminders with push notifications
- **Multi-User Support**: Share household data with family members
- **Google Authentication**: Secure sign-in with Google accounts
- **Real-time Sync**: Live updates across all connected devices

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Backend**: Firebase (Firestore, Authentication, Storage, Cloud Functions)
- **Styling**: Tailwind CSS with Material Design 3 components
- **Notifications**: Firebase Cloud Messaging (FCM)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase CLI
- A Firebase project with:
  - Firestore Database
  - Authentication (Google provider enabled)
  - Storage
  - Cloud Functions (for push notifications)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd GSHSHOPING
```

2. Install dependencies:
```bash
npm install
cd functions
npm install
cd ..
```

3. Configure Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firestore, Authentication (Google), Storage, and Cloud Functions
   - Copy your Firebase config to `public/utils/firebase.js`

4. Deploy Firestore rules:
```bash
firebase deploy --only firestore:rules
```

5. Deploy Storage rules:
```bash
firebase deploy --only storage:rules
```

6. Deploy Cloud Functions:
```bash
firebase deploy --only functions
```

7. Deploy hosting:
```bash
firebase deploy --only hosting
```

## Project Structure

```
GSHSHOPING/
├── public/                 # Public web assets
│   ├── index.html         # Main HTML file
│   ├── js/                # JavaScript modules
│   │   ├── modules/       # Feature modules (shopping, tasks, notes, reminders)
│   │   └── utils/         # Utility functions
│   ├── css/               # Stylesheets
│   └── utils/             # Firebase utilities
├── functions/             # Cloud Functions
│   └── index.js          # Push notification functions
├── firestore.rules       # Firestore security rules
├── storage.rules         # Storage security rules
└── firebase.json         # Firebase configuration
```

## Development

### Building CSS

Watch for changes:
```bash
npm run watch-css
```

Build for production:
```bash
npm run build-css
```

## Deployment

Deploy everything:
```bash
firebase deploy
```

Deploy specific services:
```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## License

ISC

## Version

0.9


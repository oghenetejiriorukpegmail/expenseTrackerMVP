# Expense Tracker MVP

A full-stack expense tracker application with receipt management capabilities. This application allows users to track expenses, manage receipts, and organize expenses by trips.

## Features

- **User Authentication**: Secure login and registration system
- **Expense Management**: Create, read, update, and delete expenses
- **Receipt Management**: Upload, view, and manage receipts for expenses
- **Trip Organization**: Organize expenses by trips
- **Responsive UI**: Modern UI built with React and Tailwind CSS

## Tech Stack

### Frontend
- React
- TanStack Query (React Query)
- Tailwind CSS
- Shadcn UI Components
- Wouter (Routing)
- Recharts (Charts)
- React Hook Form + Zod (Form validation)

### Backend
- Node.js
- Express
- PostgreSQL (via Supabase)
- Drizzle ORM
- Supabase Storage (File storage)

## Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn
- PostgreSQL database (or Supabase account)

### Installation

1. Clone the repository
```bash
git clone https://github.com/oghenetejiriorukpegmail/expenseTrackerMVP.git
cd expenseTrackerMVP
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following variables:
```
DATABASE_URL=your_postgresql_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SESSION_SECRET=your_session_secret
```

4. Run the development server
```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

The build output will be in the `dist/public` directory.

## Project Structure

- `client/`: Frontend React application
- `server/`: Backend Express API
- `shared/`: Shared code between frontend and backend
- `api/`: API routes for serverless deployment
- `migrations/`: Database migration files

## License

MIT
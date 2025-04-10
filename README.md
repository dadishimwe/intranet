# Corporate Intranet Solution

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
![Vue.js](https://img.shields.io/badge/Vue.js-3-4FC08D?logo=vuedotjs)
![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=nodedotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13-4169E1?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-24.0-2496ED?logo=docker)

A comprehensive internal portal for businesses, featuring user management, document sharing, departmental wikis, and more. Designed for performance and security even on low-resource environments like Raspberry Pi.

## Overview
This corporate intranet solution provides a centralized platform for internal communication, document management, and employee directory services. Built with a modern stack including Vue.js, Node.js/Express, and PostgreSQL, the application runs efficiently within Docker containers for easy deployment and scaling.

## Features

### User Management System
- Comprehensive employee directory
- Role-based access control (Admin, Manager, Employee)
- Detailed employee profiles with contact information
- Organizational chart visualization

### Knowledge Base / Wiki
- Markdown-based content editing
- Full-text search capabilities
- Version history and revision tracking
- Departmental categorization and tagging

### Document Management
- Secure file uploads and storage
- Document categorization and search
- Version control for important documents

### Department Management
- Departmental structure and hierarchy
- Team directories and contact information

### Security Features
- JWT-based authentication
- Role-based authorization
- SSL/TLS support for encrypted communications

## System Requirements
- Raspberry Pi 3/4 with 2GB+ RAM (or any Linux/Unix system)
- 16GB+ storage space
- Docker and Docker Compose installed
- Network connectivity for accessing the portal

## Technology Stack

| Component          | Technology                   |
|--------------------|------------------------------|
| Frontend           | Vue.js 3, PrimeVue           |
| Backend            | Node.js, Express.js          |
| Database           | PostgreSQL 13                |
| Web Server         | Nginx                        |
| Containerization   | Docker & Docker Compose      |
| Authentication     | JWT (JSON Web Tokens)        |
| CSS Framework      | PrimeVue UI Components       |
| State Management   | Vuex                         |
| Routing            | Vue Router                   |

## Installation Guide

### Prerequisites
Ensure you have Docker and Docker Compose installed on your system:
```bash
# Check Docker installation
docker --version

# Check Docker Compose installation
docker-compose --version
```
### Setup Steps
#### Clone the repository
```bash
git clone https://your-repository-url/corporate-intranet.git
cd corporate-intranet
```
#### Create environment file
```bash
DB_USER=postgres
DB_PASSWORD=your_strong_password
DB_NAME=corporate_intranet
JWT_SECRET=your_generated_jwt_secret
JWT_EXPIRES_IN=24h
```
#### Generate JWT secret
```bash
# Node.js method
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL method
openssl rand -hex 64
```
#### Build and start
```bash
docker-compose up -d --build
docker-compose logs -f
```
#### Initialize system
```bash
docker-compose exec backend npm run seed:admin
```
### Maintenance
#### Update Application
```bash
git pull
docker-compose down
docker-compose up -d --build
```
#### Database Access
```bash
docker-compose exec database psql -U postgres -d corporate_intranet
```
### Troubleshooting
#### Container Status
```bash
docker-compose ps
docker-compose logs backend
```
#### Performance Monitoring
```bash
htop  # System resources
docker stats  # Container metrics
```
### Architecture
#### Project Structure
```bash
corporate-intranet/
├── docker-compose.yml           # Main deployment configuration
├── .env                         # Environment variables
├── nginx/                       # Web server configuration
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                     # Express.js application
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                # Entry point
│   ├── config/                  # Configuration files
│   │   ├── database.js
│   │   └── auth.js
│   ├── models/                  # Database models
│   │   ├── User.js
│   │   ├── Department.js
│   │   ├── Document.js
│   │   ├── Event.js
│   │   └── Expense.js
│   ├── routes/                  # API endpoints
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── departments.js
│   │   ├── calendar.js
│   │   ├── knowledge.js
│   │   └── expenses.js
│   ├── controllers/             # Business logic
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── departmentController.js
│   │   ├── calendarController.js
│   │   ├── knowledgeController.js
│   │   └── expenseController.js
│   ├── middleware/              # Request processors
│   │   ├── auth.js
│   │   └── validation.js
│   └── utils/                   # Helper functions
│       ├── logger.js
│       └── fileStorage.js
├── frontend/                    # Vue.js application
│   ├── Dockerfile
│   ├── package.json
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── main.js              # Entry point
│   │   ├── App.vue              # Root component
│   │   ├── router/              # Route definitions
│   │   │   └── index.js
│   │   ├── store/               # State management
│   │   │   ├── index.js
│   │   │   ├── modules/
│   │   │   │   ├── auth.js
│   │   │   │   ├── users.js
│   │   │   │   ├── calendar.js
│   │   │   │   ├── knowledge.js
│   │   │   │   └── expenses.js
│   │   ├── components/          # UI components
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.vue
│   │   │   │   ├── Header.vue
│   │   │   │   └── Footer.vue
│   │   │   ├── users/
│   │   │   ├── departments/
│   │   │   ├── calendar/
│   │   │   ├── knowledge/
│   │   │   └── expenses/
│   │   └── views/               # Page components
│   │       ├── Home.vue
│   │       ├── Login.vue
│   │       ├── Users.vue
│   │       ├── OrgChart.vue
│   │       ├── Calendar.vue
│   │       ├── Documents.vue
│   │       ├── Wiki.vue
│   │       └── Expenses.vue
├── database/                    # Database setup
│   ├── Dockerfile
│   ├── init.sql                 # Initial schema
│   └── backup.sh                # Backup script
└── scripts/                     # Utility scripts
    ├── setup.sh                 # Initial setup
    ├── backup.sh                # Backup routine
    └── update.sh                # Update procedure
```
### Security
####🔒 Rotate JWT secrets quarterly
####🔐 Mandatory password changes every 90 days
####🛡️ Regular Docker image updates
####💾 Daily encrypted backups
###License
####Distributed under MIT License.
####Copyright © 2025 Your Company Name

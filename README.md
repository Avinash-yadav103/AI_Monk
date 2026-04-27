# AIMonk Full Stack Coding Assignment Solution

This repository contains a full stack implementation using:

- Frontend: React (Vite)
- Backend: Flask + SQLAlchemy
- Database: MySQL

## Features Implemented

- Recursive `TagView` rendering for nested tree hierarchy.
- `data` field editable through input fields.
- Recursive collapse/expand (`v` / `>`), including root tag.
- `Add Child` button on every tag:
  - If tag has `data`, it is replaced by `children`.
  - New child is `{ name: "New Child", data: "Data" }`.
- Export button:
  - Shows JSON string containing only `name`, `children`, `data`.
  - Saves tree to backend via REST API.
- Backend persistence in MySQL:
  - `GET /api/trees` returns all trees.
  - `POST /api/trees` creates a new tree.
  - `PUT /api/trees/:id` updates existing tree.
- On app load, frontend fetches all saved trees and renders each one.
- Bonus: Click a tag name to edit it, press Enter (or blur) to commit.

## Project Structure

- `frontend/` React UI
- `backend/` Flask API
- `docker-compose.yml` optional MySQL container setup

## Quick Start

## 1) Start MySQL

Option A: Local MySQL installation.

- Create database:
  - `CREATE DATABASE IF NOT EXISTS tagtree_db;`

Option B: Docker.

- From repository root run:
  - `docker compose up -d`

## 2) Run Backend (Flask)

1. Open terminal in `backend/`.
2. Create and activate a virtual environment.
3. Install dependencies:
   - `pip install -r requirements.txt`
4. Set environment variable if needed:
   - `DATABASE_URL=mysql+pymysql://root:password@localhost:3306/tagtree_db`
5. Start server:
   - `python app.py`

Backend runs on `http://localhost:5000`.

## 3) Run Frontend (React)

1. Open terminal in `frontend/`.
2. Install packages:
   - `npm install`
3. (Optional) create `frontend/.env` with:
   - `VITE_API_BASE_URL=http://localhost:5000/api`
4. Start frontend:
   - `npm run dev`

Frontend runs on `http://localhost:5173`.

## API Contract

- `GET /api/trees`
  - Response: `[{ id, tree, createdAt, updatedAt }]`

- `POST /api/trees`
  - Body: `{ "tree": { ...tagTree } }` (also accepts raw tree object)
  - Response: created record with `id`

- `PUT /api/trees/:id`
  - Body: `{ "tree": { ...tagTree } }` (also accepts raw tree object)
  - Response: updated record

## Tree Validation Rules

Each node must have:

- `name` (non-empty string)
- Exactly one of:
  - `children` (array of nodes), OR
  - `data` (string)

## Notes

- Frontend keeps internal UI fields (collapse/edit/key state) but strips them during export/save.
- If backend has no saved trees, UI initializes with the sample tree from the assignment.

# Buckshot Roulette Multiplayer

A real-time, browser-based 2-player multiplayer version of Buckshot Roulette.

## Game Rules

Two players take turns aiming a virtual shotgun loaded with live and blank shells.
Each round starts with a randomized shell mix.
Players choose to shoot themselves or their opponent.
Use items like Magnifier, Beer, Handcuffs, Saw, and Cigarettes to gain advantages.
First to reduce the other's HP from 6 to 0 wins.

## How to Play

1. One player creates a room.
2. Share the room link with a friend.
3. Join and start playing.

## Development

### Prerequisites

- Node.js
- npm

### Setup

1. Clone the repo.
2. Install dependencies:

   ```bash
   cd client
   npm install

   cd ../server
   npm install
   ```

3. Start the server:

   ```bash
   cd server
   npm start
   ```

4. Start the client:

   ```bash
   cd client
   npm start
   ```

## Deployment

- Frontend: Deploy `client` to Vercel or Netlify.
- Backend: Deploy `server` to Render or Railway.

Update the socket URL in `client/src/App.js` to the deployed server URL.

## Technologies

- Frontend: React, Socket.IO Client
- Backend: Node.js, Express, Socket.IO
- Hosting: Vercel (frontend), Render (backend)
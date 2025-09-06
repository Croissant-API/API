# Croissant API

## You can use this icon to search and travel through endpoints
<img width="127" height="84" alt="image" src="https://github.com/user-attachments/assets/57ab5e79-dc48-42c6-86d7-88ac5838da12" />

This API provides endpoints for inventories, items, lobbies, trades, users, OAuth2, and studios.

## Authentication

Some endpoints require authentication via a token.

## Endpoints

### Inventories

#### `GET /api/inventory/@me`
Get the inventory of the authenticated user with all item instances and item details.

**Requires authentication**

**Response:**
```json
{
  "user_id": "string",
  "inventory": [
    {
      "user_id": "string",
      "item_id": "string",
      "amount": "number",
      "metadata": "object (optional, includes _unique_id for unique items)",
      "sellable": "boolean",
      "purchasePrice": "number (optional)",
      "itemId": "string",
      "name": "string",
      "description": "string",
      "iconHash": "string",
      "price": "number",
      "owner": "string",
      "showInStore": "boolean"
    }
  ]
}
```
**Example:**
```http
GET /api/inventory/@me
Authorization: Bearer <token>
```

---

#### `GET /api/inventory/:userId`
Get the inventory of a user with all item instances and item details.

**Parameters:**
- `userId`: The id of the user

**Response:** (same as above)

**Example:**
```http
GET /api/inventory/123
```

---

#### `GET /api/inventory/:userId/item/:itemId/amount`
Get the amount of a specific item for a user.

**Parameters:**
- `userId`: The id of the user
- `itemId`: The id of the item

**Response:**
```json
{
  "userId": "string",
  "itemId": "string",
  "amount": "number"
}
```
**Example:**
```http
GET /api/inventory/123/item/456/amount
```

---

### Items

#### `GET /api/items`
Get all non-deleted items visible in store.

**Response:**
```json
{
  "items": [
    {
      "itemId": "string",
      "name": "string",
      "description": "string",
      "owner": "string",
      "price": "number",
      "iconHash": "string",
      "showInStore": "boolean"
    }
  ]
}
```
**Example:**
```http
GET /api/items
```

---

#### `GET /api/items/@mine`
Get all items owned by the authenticated user.

**Requires authentication**

**Response:**
```json
{
  "items": [
    {
      "itemId": "string",
      "name": "string",
      "description": "string",
      "owner": "string",
      "price": "number",
      "iconHash": "string",
      "showInStore": "boolean"
    }
  ]
}
```
**Example:**
```http
GET /api/items/@mine
Authorization: Bearer <token>
```

---

#### `GET /api/items/search?q=Apple`
Search for items by name (only those visible in store).

**Query:**
- `q`: The search query

**Response:**
```json
{
  "items": [
    {
      "itemId": "string",
      "name": "string",
      "description": "string",
      "owner": "string",
      "price": "number",
      "iconHash": "string",
      "showInStore": "boolean"
    }
  ]
}
```
**Example:**
```http
GET /api/items/search?q=Apple
```

---

#### `GET /api/items/:itemId`
Get a single item by itemId.

**Parameters:**
- `itemId`: The id of the item

**Response:**
```json
{
  "itemId": "string",
  "name": "string",
  "description": "string",
  "owner": "string",
  "price": "number",
  "showInStore": "boolean",
  "iconHash": "string"
}
```
**Example:**
```http
GET /api/items/123
```

---

#### `POST /api/items/create`
Create a new item.

**Requires authentication**

**Body:**
- `name`: Name of the item
- `description`: Description of the item
- `price`: Price of the item
- `iconHash`: Hash of the icon (optional)
- `showInStore`: Show in store (optional, boolean)

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/items/create
{
  "name": "Apple",
  "description": "A fruit",
  "price": 100,
  "iconHash": "abc123",
  "showInStore": true
}
Authorization: Bearer <token>
```

---

#### `PUT /api/items/update/:itemId`
Update an existing item.

**Requires authentication**

**Parameters:**
- `itemId`: The id of the item

**Body:**
- `name`: Name of the item
- `description`: Description of the item
- `price`: Price of the item
- `iconHash`: Hash of the icon (optional)
- `showInStore`: Show in store (optional, boolean)

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
PUT /api/items/update/123
{
  "name": "Apple",
  "description": "A fruit",
  "price": 100,
  "iconHash": "abc123",
  "showInStore": true
}
Authorization: Bearer <token>
```

---

#### `DELETE /api/items/delete/:itemId`
Delete an item.

**Requires authentication**

**Parameters:**
- `itemId`: The id of the item

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
DELETE /api/items/delete/123
Authorization: Bearer <token>
```

---

### Lobbies

#### `POST /api/lobbies`
Create a new lobby.

**Requires authentication**

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/lobbies
Authorization: Bearer <token>
```

---

#### `GET /api/lobbies/:lobbyId`
Get a lobby by lobbyId.

**Parameters:**
- `lobbyId`: The id of the lobby

**Response:**
```json
{
  "lobbyId": "string",
  "users": [
    {
      "username": "string",
      "user_id": "string",
      "verified": "boolean",
      "steam_username": "string",
      "steam_avatar_url": "string",
      "steam_id": "string"
    }
  ]
}
```
**Example:**
```http
GET /api/lobbies/123
```

---

#### `POST /api/lobbies/:lobbyId/join`
Join a lobby. This will make the user leave all other lobbies first.

**Requires authentication**

**Parameters:**
- `lobbyId`: The id of the lobby

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/lobbies/123/join
Authorization: Bearer <token>
```

---

#### `POST /api/lobbies/:lobbyId/leave`
Leave a lobby.

**Requires authentication**

**Parameters:**
- `lobbyId`: The id of the lobby

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/lobbies/123/leave
Authorization: Bearer <token>
```

---

### Trades

#### `POST /api/trades/start-or-latest/:userId`
Start a new trade or get the latest pending trade with a user.

**Requires authentication**

**Parameters:**
- `userId`: The ID of the user to trade with

**Response:**
```json
{
  "id": "string",
  "fromUserId": "string",
  "toUserId": "string",
  "fromUserItems": ["object"],
  "toUserItems": ["object"],
  "approvedFromUser": "boolean",
  "approvedToUser": "boolean",
  "status": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```
**Example:**
```http
POST /api/trades/start-or-latest/user123
Authorization: Bearer <token>
```

---

#### `GET /api/trades/:id`
Get a trade by ID with enriched item information.

**Requires authentication**

**Parameters:**
- `id`: The ID of the trade

**Response:**
```json
{
  "id": "string",
  "fromUserId": "string",
  "toUserId": "string",
  "fromUserItems": [
    {
      "itemId": "string",
      "name": "string",
      "description": "string",
      "iconHash": "string",
      "amount": "number"
    }
  ],
  "toUserItems": [
    {
      "itemId": "string",
      "name": "string",
      "description": "string",
      "iconHash": "string",
      "amount": "number"
    }
  ],
  "approvedFromUser": "boolean",
  "approvedToUser": "boolean",
  "status": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```
**Example:**
```http
GET /api/trades/trade123
Authorization: Bearer <token>
```

---

#### `GET /api/trades/user/:userId`
Get all trades for a user with enriched item information.

**Requires authentication**

**Parameters:**
- `userId`: The ID of the user

**Response:**
```json
{
  "trades": [
    {
      "id": "string",
      "fromUserId": "string",
      "toUserId": "string",
      "fromUserItems": [
        {
          "itemId": "string",
          "name": "string",
          "description": "string",
          "iconHash": "string",
          "amount": "number"
        }
      ],
      "toUserItems": [
        {
          "itemId": "string",
          "name": "string",
          "description": "string",
          "iconHash": "string",
          "amount": "number"
        }
      ],
      "approvedFromUser": "boolean",
      "approvedToUser": "boolean",
      "status": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```
**Example:**
```http
GET /api/trades/user/user123
Authorization: Bearer <token>
```

---

#### `POST /api/trades/:id/add-item`
Add an item to a trade.

**Requires authentication**

**Parameters:**
- `id`: The ID of the trade

**Body:**
- `tradeItem`: {
    - `itemId`: The ID of the item to add
    - `amount`: The amount of the item to add
    - `metadata`: Metadata object including _unique_id for unique items (optional)
  }

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/trades/trade123/add-item
{
  "tradeItem": {"itemId": "item456", "amount": 5}
}
Authorization: Bearer <token>
```
Or with metadata:
```http
POST /api/trades/trade123/add-item
{
  "tradeItem": {"itemId": "item456", "amount": 1, "metadata": {"level": 5, "_unique_id": "abc-123"}}
}
Authorization: Bearer <token>
```

---

#### `POST /api/trades/:id/remove-item`
Remove an item from a trade.

**Requires authentication**

**Parameters:**
- `id`: The ID of the trade

**Body:**
- `tradeItem`: {
    - `itemId`: The ID of the item to remove
    - `amount`: The amount of the item to remove
    - `metadata`: Metadata object including _unique_id for unique items (optional)
  }

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/trades/trade123/remove-item
{
  "tradeItem": {"itemId": "item456", "amount": 2}
}
Authorization: Bearer <token>
```
Or with metadata:
```http
POST /api/trades/trade123/remove-item
{
  "tradeItem": {"itemId": "item456", "metadata": {"_unique_id": "abc-123"}}
}
Authorization: Bearer <token>
```

---

#### `PUT /api/trades/:id/approve`
Approve a trade.

**Requires authentication**

**Parameters:**
- `id`: The ID of the trade

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
PUT /api/trades/trade123/approve
Authorization: Bearer <token>
```

---

#### `PUT /api/trades/:id/cancel`
Cancel a trade.

**Requires authentication**

**Parameters:**
- `id`: The ID of the trade

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
PUT /api/trades/trade123/cancel
Authorization: Bearer <token>
```

---

### Users

#### `GET /api/users/@me`
Get the current authenticated user's profile, including studios, roles, inventory, owned items, and created games.

**Response:**
```json
{
  "userId": "string",
  "username": "string",
  "email": "string",
  "verified": "boolean",
  "studios": "array",
  "roles": "array",
  "inventory": "array",
  "ownedItems": "array",
  "createdGames": "array",
  "verificationKey": "string"
}
```
**Example:**
```http
GET /api/users/@me
Authorization: Bearer <token>
```

---

#### `GET /api/users/search?q=John`
Search for users by username.

**Query:**
- `q`: The search query

**Response:**
```json
{
  "users": [
    {
      "userId": "string",
      "username": "string",
      "verified": "boolean",
      "steam_id": "string",
      "steam_username": "string",
      "steam_avatar_url": "string",
      "isStudio": "boolean",
      "admin": "boolean",
      "inventory": "array",
      "ownedItems": "array",
      "createdGames": "array"
    }
  ]
}
```
**Example:**
```http
GET /api/users/search?q=John
```

---

#### `GET /api/users/:userId`
Get a user by userId. userId can be a Croissant ID, Discord ID, Google ID or Steam ID.

**Parameters:**
- `userId`: The id of the user

**Response:**
```json
{
  "userId": "string",
  "username": "string",
  "verified": "boolean",
  "steam_id": "string",
  "steam_username": "string",
  "steam_avatar_url": "string",
  "isStudio": "boolean",
  "admin": "boolean",
  "inventory": "array",
  "ownedItems": "array",
  "createdGames": "array"
}
```
**Example:**
```http
GET /api/users/123
```

---

#### `POST /api/users/transfer-credits`
Transfer credits from one user to another.

**Requires authentication**

**Body:**
- `targetUserId`: The id of the recipient
- `amount`: The amount to transfer

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/users/transfer-credits
{
  "targetUserId": "456",
  "amount": 50
}
Authorization: Bearer <token>
```

---

#### `POST /api/users/auth-verification`
Check the verification key for the user.

**Query:**
- `userId`: The id of the user
- `verificationKey`: The verification key

**Response:**
```json
{
  "success": "boolean"
}
```
**Example:**
```http
POST /api/users/auth-verification?userId=123&verificationKey=abc123
```

---

### OAuth2

#### `GET /api/oauth2/app/:client_id`
Get an OAuth2 app by client_id.

**Parameters:**
- `client_id`: The client_id of the app

**Response:**
```json
{
  "client_id": "string",
  "client_secret": "string",
  "name": "string",
  "redirect_urls": ["string"]
}
```
**Example:**
```http
GET /api/oauth2/app/123
```

---

#### `POST /api/oauth2/app`
Create a new OAuth2 app.

**Requires authentication**

**Body:**
- `name`: Name of the app
- `redirect_urls`: Array of redirect URLs

**Response:**
```json
{
  "client_id": "string",
  "client_secret": "string"
}
```
**Example:**
```http
POST /api/oauth2/app
{
  "name": "My App",
  "redirect_urls": ["https://example.com/callback"]
}
Authorization: Bearer <token>
```

---

#### `GET /api/oauth2/apps`
Get all OAuth2 apps owned by the authenticated user.

**Requires authentication**

**Response:**
```json
{
  "apps": [
    {
      "client_id": "string",
      "client_secret": "string",
      "name": "string",
      "redirect_urls": ["string"]
    }
  ]
}
```
**Example:**
```http
GET /api/oauth2/apps
Authorization: Bearer <token>
```

---

#### `PATCH /api/oauth2/app/:client_id`
Update an OAuth2 app.

**Requires authentication**

**Parameters:**
- `client_id`: The client_id of the app

**Body:**
- `name`: Name of the app (optional)
- `redirect_urls`: Array of redirect URLs (optional)

**Response:**
```json
{
  "success": "boolean"
}
```
**Example:**
```http
PATCH /api/oauth2/app/123
{
  "name": "Updated App"
}
Authorization: Bearer <token>
```

---

#### `DELETE /api/oauth2/app/:client_id`
Delete an OAuth2 app.

**Requires authentication**

**Parameters:**
- `client_id`: The client_id of the app

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
DELETE /api/oauth2/app/123
Authorization: Bearer <token>
```

---

#### `GET /api/oauth2/authorize`
Authorize a user for an OAuth2 app.

**Requires authentication**

**Query:**
- `client_id`: The client_id of the app
- `redirect_uri`: The redirect URI

**Response:**
```json
{
  "code": "string"
}
```
**Example:**
```http
GET /api/oauth2/authorize?client_id=123&redirect_uri=https://example.com/callback
Authorization: Bearer <token>
```

---

#### `GET /api/oauth2/user`
Get user information by authorization code.

**Query:**
- `code`: The authorization code
- `client_id`: The client_id of the app

**Response:**
```json
{
  "username": "string",
  "user_id": "string",
  "email": "string",
  "balance": "number",
  "verified": "boolean",
  "steam_username": "string",
  "steam_avatar_url": "string",
  "steam_id": "string",
  "discord_id": "string",
  "google_id": "string",
  "verificationKey": "string"
}
```
**Example:**
```http
GET /api/oauth2/user?code=abc123&client_id=456
```

---

### Studios

#### `POST /api/studios`
Create a new studio.

**Requires authentication**

**Body:**
- `studioName`: Name of the studio

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/studios
{
  "studioName": "My Studio"
}
Authorization: Bearer <token>
```

---

#### `GET /api/studios/:studioId`
Get a studio by studioId.

**Parameters:**
- `studioId`: The ID of the studio to retrieve

**Response:**
```json
{
  "user_id": "string",
  "username": "string",
  "verified": "boolean",
  "admin_id": "string",
  "users": [
    {
      "user_id": "string",
      "username": "string",
      "verified": "boolean",
      "admin": "boolean"
    }
  ]
}
```
**Example:**
```http
GET /api/studios/studio123
```

---

#### `GET /api/studios/user/@me`
Get all studios the authenticated user is part of.

**Requires authentication**

**Response:**
```json
{
  "studios": [
    {
      "user_id": "string",
      "username": "string",
      "verified": "boolean",
      "admin_id": "string",
      "isAdmin": "boolean",
      "apiKey": "string",
      "users": [
        {
          "user_id": "string",
          "username": "string",
          "verified": "boolean",
          "admin": "boolean"
        }
      ]
    }
  ]
}
```
**Example:**
```http
GET /api/studios/user/@me
Authorization: Bearer <token>
```

---

#### `POST /api/studios/:studioId/add-user`
Add a user to a studio.

**Requires authentication**

**Parameters:**
- `studioId`: The ID of the studio

**Body:**
- `userId`: The ID of the user to add

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/studios/studio123/add-user
{
  "userId": "user456"
}
Authorization: Bearer <token>
```

---

#### `POST /api/studios/:studioId/remove-user`
Remove a user from a studio.

**Requires authentication**

**Parameters:**
- `studioId`: The ID of the studio

**Body:**
- `userId`: The ID of the user to remove

**Response:**
```json
{
  "message": "string"
}
```
**Example:**
```http
POST /api/studios/studio123/remove-user
{
  "userId": "user456"
}
Authorization: Bearer <token>
```

---

## Response Format

All responses are JSON.

---

For full details, see the [API documentation](https://croissant-api.fr/api-docs) or source code.


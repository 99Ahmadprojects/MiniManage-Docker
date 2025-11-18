FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

# Create db directory for SQLite (will be mounted from host)
RUN mkdir -p /app/db

EXPOSE 5000

CMD ["npm", "start"]

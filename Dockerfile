# Dockerfile en raíz (opcional si quieres controlar todo desde ahí)
FROM node:18

WORKDIR /app
COPY stagehand ./stagehand

WORKDIR /app/stagehand

RUN npm install

CMD ["npm", "start"]

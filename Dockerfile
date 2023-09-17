FROM node:lts-alpine3.18

WORKDIR /app

COPY package* ./

RUN npm ci

COPY . .

CMD ["npm", "test"]
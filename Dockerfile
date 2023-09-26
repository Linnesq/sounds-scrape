FROM node:18.17.1-alpine3.18

WORKDIR /app

COPY package* ./

RUN npm ci

COPY . .

CMD ["npm", "test"]
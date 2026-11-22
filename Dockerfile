FROM node:26.13.1-alpine3.24

WORKDIR /app

COPY package* ./

RUN npm ci

COPY . .

CMD ["npm", "test"]
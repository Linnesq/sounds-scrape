FROM node:26.13.1-alpine3.24

RUN npm i -g run-func@3.0.0

WORKDIR /app

COPY package* ./

RUN npm ci

COPY . .

CMD ["npm", "test"]
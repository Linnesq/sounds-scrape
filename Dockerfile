FROM node:18.17.1-alpine3.18

RUN npm i -g run-func

WORKDIR /app

COPY package* ./

RUN npm ci

COPY . .

CMD ["npm", "test"]
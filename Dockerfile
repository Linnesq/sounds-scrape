FROM node:14.16.0-alpine3.13

WORKDIR /app

COPY package* ./

RUN npm install

COPY . .

CMD ["npm", "test"]
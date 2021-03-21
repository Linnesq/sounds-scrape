### What is this?

POC Scraper for BBC Sounds. Pulls out show tracklists and creates spotify playlists (developer account required). It's a scraper, so it's going to be quite brittle.

### How does it work?

Uses XPath to extract show URLS from the page in config. Then we pull those pages and extract a JSON object from a `<script>` tag on those pages which, with a bit of string manipulation, can be parsed into a JSON object rich in show data. It's from this that we can extract tracklists.

That data is stored in a file called latest.json so you can run `index.js` using that rather than re-scraping. Be a nice citizen and also try not to get yourself bot-blocked (I assume BBC employs some bot-blocking).

Then the show data is uploaded to spotify (if the show playlist doesn't already exist).

I made this because I really like Benji B's show, but they only keep up the last 5 episodes, so I can keep show tracklists for posterity and also get great songs into my spotify liked list ♥.

### How to run (Docker)

make an `auth.json` file in the project root, e.g.

```
{
    "clientId": "from-your-spotify-app",
    "clientSecret": "from-your-spotify-app",
    "redirectUri": "https://localhost/callback",
}
```

And change the config file to a show of your liking (this hasn't been tested yet on anything but the show in there)

Build the image:

```
docker build -t benji .
```

and then run the following command

```
docker run -t benji npx run-func ./app/spotify/auth.js printAuthorizeUrl
```

copy the URL output in terminal and open in your browser. It will redirect you to a non-existant page on localhost (or whatever you configure as your callback URL) - that doesn't matter. Extract the `code` from the URL in the address bar. Then, no longer than a few minutes after your command above, run:

```
docker run -t benji npx run-func ./app/spotify/auth.js initialiseAuthorisation <code-from-last-command>
```

You should now have everything (5 things) you need in `auth.json`. The App will use this to authenticate.
Check everything is working OK by running

```
npx run-func ./app/spotify/auth.js init
```

To run the application and create playlists for real, run:

```
docker run -t benji npm run tasks
```
### What is this?

POC Scraper for BBC Sounds. Pulls out show tracklists and creates spotify playlists (developer account required). It's a scraper, so it's going to be quite brittle.

### How does it work?

Uses regex to extract episode URLs from the show pages in config. Then we pull those episode pages and extract the `__NEXT_DATA__` JSON from a `<script>` tag, which contains rich show data including tracklists with Spotify links.

Then the tracklist data is uploaded to Spotify - creating new playlists or updating existing ones if they have fewer tracks than the latest BBC data.

I made this because I really like Benji B's show, but they only keep up the last 5 episodes, so I can keep show tracklists for posterity and also get great songs into my spotify liked list ♥.

### How to run (Docker, with code checked out)

make an `auth.json` file in the project root, e.g.

```
{
    "clientId": "from-your-spotify-app",
    "clientSecret": "from-your-spotify-app",
    "redirectUri": "http://127.0.0.1:80/callback"
}
```

And change the config file to a show of your liking (this hasn't been tested yet on anything but the show in there)

Build the image:

```
make build
```

and then run the following command:

```
make auth-url
```

copy the URL output in terminal and open in your browser. It will redirect you to a non-existant page on localhost (or whatever you configure as your callback URL) - that doesn't matter. Extract the `code` from the URL in the address bar. Then, no longer than a few minutes after your command above, run:

```
AUTH_CODE=your_code make authenticate
```

The `./auth.json` is mounted so you should now have everything (5 things) you need in `auth.json`. The App will use this to authenticate. Check everything is working OK by running:

```
make check-auth
```

And you should see something like this if all is set up

```
make check-auth 
docker run --rm -v ./auth.json:/app/auth.json --name soundscrape-container soundscrape npm run check-auth

> benji-scraper@1.0.0 check-auth
> npx run-func ./app/spotify/auth.js init

2025-11-08T14:40:46.454Z - init success
```

To run the application and create playlists for real, run:

```
make playlists
```

### Spotify App Settings

There is a guide on creating an app [here](https://developer.spotify.com/documentation/web-api/tutorials/getting-started), but the general settings I use are:

1. I made an app on https://developer.spotify.com/dashboard
2. for "App Status" I just use `Developer Mode`
3. for "Redirect URIs" I just use `http://127.0.0.1:80/callback`
4. Once you have your client ID, client Secret and valid redirect URI, you can follow the guide above.

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

Then log in to Spotify:

```
make login
```

This prints a Spotify URL. Open it in your browser and approve access. Spotify then redirects your browser back to your `redirectUri`, where `make login` is listening. It saves your tokens to `auth.json` (which is mounted into the container) and confirms which account you logged in as:

```
2026-11-22T13:30:00.000Z - Login complete - authenticated as <your Spotify name>
```

If your `redirectUri` uses a port other than 80, run `AUTH_PORT=<port> make login`.

**No browser on this machine (e.g. a server)?** Either run `make login` on a machine that has one and copy `auth.json` across, or do it by hand: run `make auth-url`, open the URL in any browser, and after Spotify redirects you, copy the `code` parameter from the address bar (the page itself won't load). Within a few minutes, run `AUTH_CODE=your_code make authenticate`.

You can check your credentials at any time with:

```
make check-auth
```

which should end with something like:

```
2026-11-22T13:31:00.000Z - Auth OK - authenticated as <your Spotify name>
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

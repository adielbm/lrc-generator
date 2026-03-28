A nice tool for creating [LRC files](https://en.wikipedia.org/wiki/LRC_%28file_format%29). 
(LRC (short for LyRiCs) is a computer file format that synchronizes song lyrics with an audio file, such as MP3, Vorbis or MIDI. Wikipedia)

## Example
![Screenshot](screenshot.jpg)

And this is the LRC file created.
```
[ti:Ring Them Bells]
[ar:Bob Dylan]
[al:Oh Mercy]
[by:Your Name]
[re:adielbm.github.io/lrc-generator]
[ve:0.1.0]
[length:03:00.76]
#Generated with LRC Generator
[00:11.18]Ring them bells, ye heathen
[00:15.42]From the city that dreams,
[00:18.10]Ring them bells from the sanctuaries
[00:20.23]Cross the valleys and streams,
[00:22.37]For they're deep and they're wide
[00:26.69]And the world's on its side
[00:29.26]And time is running backwards
...
...
...
```

## Dev
First, run the server:
```bash
npm install
npm run dev
```

## GitHub Pages
This project is configured to deploy automatically to GitHub Pages when `main` is updated.

1. In GitHub, open repository settings.
2. Go to Pages.
3. Set Source to `GitHub Actions`.
4. Push to `main` (or run the Deploy workflow manually).

Your site will be published at:
`https://adielbm.github.io/lrc-generator/`
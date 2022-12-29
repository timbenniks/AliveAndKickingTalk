# Alive and Kicking

- Vote for a song and it will be featured (I play along with it on stage).
- You have to log in to vote.
- The song page shows the current song, a player, a guitar sound visualizer, rotating album art, a sidebar with other songs and their amount of votes, guitar sound setting (midi)
- The voting screen shows the songs with its album art and an ability to vote.
  - Only one vote per song
  - You have to be logged in
- homepage is login or vote screen, has link to explanation on how app was built

## Uniform

- Index page
  - login (supabase, twitter + github)
  - voting
    - component with selected songs (using loop)
      - songs are a custom data source connected to vercel serverless function that provides basic song data like (artist, title, album art, song length, songid)
- Song page
  - connects to data source for one song (vercel serverless function)
  - additional song visuals (cloudinary)
  - song mp3 (cloudinary)
  - song sound on amp
  - components
    - song player
    - album art
    - guitar sound visualizer
    - song metadata
    - all other songs plus their votes

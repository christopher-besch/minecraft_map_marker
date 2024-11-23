# minecraft_map_marker
A Progressive Web App (PWA) to remember locations on your Minecraft server.

![minecraft_map_marker in action](./minecraft_map_marker_screenshot.png)

Example deployment: https://map.mc.chris-besch.com

As a server admin you can use [MinedMap](https://github.com/neocturne/MinedMap) to create a map of your world.
This map is what the minecraft_map_marker uses to let your players save pins (location marker on the map).
These pins are stored in the [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) of the PWA and thus private to each player.

Features:
- [Const pins](#const-pins) defined by the server admin
- Private pin storage (the minecraft_map_marker is perfect for your secret chest locations)
- Pin import and export for easy coordinate sharing
- Nether/Overworld coordinate calculator
- PWA: Install the minecraft_map_marker on your phone/laptop just as if it where a native app.
- Fully self-hosted: No trackers, CDN resources or anything else that could harm the user's privacy

## Deployment Directly on Host
- install node, npm and the typescript compiler (with `npm install -g typescript`)
- clone the repository and enter the cloned directory
- `npm install` (needed for leaflet types)
- `tsc --build`

All that is left to do is [run MinedMap](https://github.com/neocturne/MinedMap?tab=readme-ov-file#how-to-use) over your Minecraft world and put the output in the `src/data` directory: `./minedmap ./world/ ./src/data/`.
Substitute `./world/` with the path to your Minecraft world save.
Now you have the Web App in the `src` directory ready to be server by your web server of choice (i.e. nginx).

## Deployment with Docker
minecraft_map_marker comes with a convenient [Docker container](https://hub.docker.com/r/chrisbesch/minecraft_map_marker) that contains both MinedMap and the web app.
It is designed to work with the [docker_cron container](https://github.com/christopher-besch/docker_cron).
With this setup the map of your Minecraft server get's updated every five minutes or however often you like.

Take a look at [example_deployment/docker-compose.yml](./example_deployment/docker-compose.yml) for a full setup that you can start with `docker compose up` in the `example_deployment` directory.
You can access the web app under `http://localhost:80`.

## Deployment with Ansible
See the `docker_minecraft` Ansible role in: https://github.com/christopher-besch/docker_setups

## Const Pins
There are two types of pins: User Pins and Const Pins.
-   User Pins are created by the user of the minecraft_map_marker and are only accessible by the user that created the pin.
-   Const Pins are created by the admin and accessible by all users.
    These pins can't be deleted by the user.
    But the user can choose to hide all of them on the map.
    As the server admin export all the pins you want and store the json in the `src/const_pins.json` file.
There is also the temp pin, which isn't stored anywhere, and only shows the user where the coordinates they punched in are on the map.

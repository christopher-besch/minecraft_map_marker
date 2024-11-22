# build the minecraft_map_marker
FROM debian AS builder

RUN apt-get update && apt-get install -y nodejs npm
RUN npm install -g typescript

WORKDIR /minecraft_map_marker
COPY ./package.json .
COPY ./package-lock.json .

RUN npm install

COPY ./src src
COPY ./tsconfig.json .

RUN tsc --build && rm src/*.ts

# install the MinedMap renderer and prepare things for the actual deployment
FROM debian

RUN apt-get update && apt-get install -y wget zip

WORKDIR /minedmap
RUN wget https://github.com/neocturne/MinedMap/releases/download/v2.2.0/MinedMap-2.2.0-x86_64-unknown-linux-gnu.zip && \
    unzip MinedMap-2.2.0-x86_64-unknown-linux-gnu.zip && \
    rm MinedMap-2.2.0-x86_64-unknown-linux-gnu.zip && \
    mv MinedMap-2.2.0-x86_64-unknown-linux-gnu/minedmap ./minedmap && \
    rm -d MinedMap-2.2.0-x86_64-unknown-linux-gnu/ && \
    bash -c 'sha256sum -c <(echo c549f45de1f7861a20839fc6be5a716c37725590038ee86b73c0691daa4794b2  minedmap)' && \
    chmod +x minedmap

COPY ./trap_script.sh ./trap_script.sh
RUN chmod +x trap_script.sh
COPY ./entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

COPY --from=builder /minecraft_map_marker/src /minedmap/minecraft_map_marker

ENTRYPOINT ["/bin/bash", "/minedmap/trap_script.sh"]

// TODO: better type
declare var createMap: any;

const initialize = async () => {
    const map = await createMap();
    // let marker = L.marker([51.5, -0.09]).addTo(map);
}

initialize();

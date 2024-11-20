// from MinedMap
declare var createMap: () => Promise<L.Map>;

type NetherCoords = {
    x: number;
    y: number | null;
    z: number;
    __brand: 'NetherCoords';
};
type OverworldCoords = {
    x: number;
    y: number | null;
    z: number;
    __brand: 'OverworldCoords';
};
function netherToOverworldCoords(coords: NetherCoords): OverworldCoords {
    return { x: coords.x * 8, y: coords.y, z: coords.z * 8, __brand: 'OverworldCoords' };
}
function overworldToNetherCoords(coords: OverworldCoords): NetherCoords {
    return { x: Math.round(coords.x / 8), y: coords.y, z: Math.round(coords.z / 8), __brand: 'NetherCoords' };
}

let overworld_x_field = document.getElementById('overworld-x') as HTMLInputElement;
let overworld_z_field = document.getElementById('overworld-z') as HTMLInputElement
let nether_x_field = document.getElementById('nether-x') as HTMLInputElement;
let nether_z_field = document.getElementById('nether-z') as HTMLInputElement
let height_field = document.getElementById('height') as HTMLInputElement
let place_pin_button = document.getElementById('place-pin') as HTMLButtonElement;

function getHeightInput(): number | null {
    if (!height_field.checkValidity()) {
        return null;
    }
    return parseInt(height_field.value) || null;
}
function getOverworldCoordsInput(): OverworldCoords | null {
    if (!overworld_x_field.checkValidity() || !overworld_z_field.checkValidity()) {
        return null;
    }
    const x = parseInt(overworld_x_field.value);
    const z = parseInt(overworld_z_field.value);
    if (!x || !z) {
        return null;
    }
    return { x, y: getHeightInput(), z, __brand: 'OverworldCoords' };
}
function getNetherCoordsInput(): NetherCoords | null {
    if (!nether_x_field.checkValidity() || !nether_z_field.checkValidity()) {
        return null;
    }
    const x = parseInt(nether_x_field.value);
    const z = parseInt(nether_z_field.value);
    if (!x || !z) {
        return null;
    }
    return { x, y: getHeightInput(), z, __brand: 'NetherCoords' };
}

function setCoords(overworld_coords: OverworldCoords) {
    const nether_coords = overworldToNetherCoords(overworld_coords);
    overworld_x_field.value = String(overworld_coords.x);
    overworld_z_field.value = String(overworld_coords.z);
    nether_x_field.value = String(nether_coords.x);
    nether_z_field.value = String(nether_coords.z);
    height_field.value = overworld_coords.y === null ? '' : String(overworld_coords.y);
}

function initializeForm(map: L.Map) {
    function updateCoordsFromOverworld() {
        const coords = getOverworldCoordsInput();
        if (coords === null)
            return;
        setCoords(coords);
    }
    function updateCoordsFromNether() {
        const coords = getNetherCoordsInput();
        if (coords === null)
            return;
        setCoords(netherToOverworldCoords(coords));
    }

    overworld_x_field.addEventListener('keyup', updateCoordsFromOverworld);
    overworld_z_field.addEventListener('keyup', updateCoordsFromOverworld);
    nether_x_field.addEventListener('keyup', updateCoordsFromNether);
    nether_z_field.addEventListener('keyup', updateCoordsFromNether);

    function placePin() {
        const coords = getOverworldCoordsInput();
        if (coords === null)
            return;
        L.marker([-coords.z, coords.x]).addTo(map);
    }
    place_pin_button.addEventListener('click', placePin);
}

const initialize = async () => {
    const map = await createMap();

    map.on('click', function(e) {
        // TODO: maybe set y to null
        setCoords({ x: Math.round(e.latlng.lng), y: getHeightInput(), z: Math.round(-e.latlng.lat), __brand: 'OverworldCoords' });
    });

    initializeForm(map);

}

initialize();

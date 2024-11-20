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

type Pin = {
    coords: OverworldCoords;
    title: string;
    description: string;
    color: string;
}

let overworld_x_field = document.getElementById('overworld-x') as HTMLInputElement;
let overworld_z_field = document.getElementById('overworld-z') as HTMLInputElement
let nether_x_field = document.getElementById('nether-x') as HTMLInputElement;
let nether_z_field = document.getElementById('nether-z') as HTMLInputElement
let height_field = document.getElementById('height') as HTMLInputElement
let title_field = document.getElementById('title') as HTMLInputElement
let description_field = document.getElementById('description') as HTMLInputElement
let color_field = document.getElementById('color') as HTMLInputElement;
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
function getPinInput(): Pin | null {
    const coords = getOverworldCoordsInput();
    if (coords === null)
        return null;

    if (!title_field.checkValidity())
        return null;
    let title = title_field.value;
    if (title === '')
        title = 'Unnamed Pin';

    if (!description_field.checkValidity())
        return null;
    const description = description_field.value;

    if (!color_field.checkValidity())
        return null;
    const color = color_field.value;

    return { coords, title, description, color };
}
function setPinInput(pin: Pin) {
    setCoords(pin.coords);
    title_field.value = pin.title;
    description_field.value = pin.description;
    color_field.value = pin.color;
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

    function createPinIcon(pin: Pin): L.DivIcon {
        const icon_path = './vendor/leaflet/images/marker-icon.png';

        let title = document.createElement('h3');
        title.textContent = pin.title;
        title.className = 'pin-title';

        // TODO: use color
        let img = document.createElement('img');
        img.src = icon_path;
        img.className = 'pin-img';


        let icon_div = document.createElement('div');
        icon_div.appendChild(img);
        icon_div.className = 'pin';
        icon_div.appendChild(title);

        console.log('do something');
        return L.divIcon({
            html: icon_div,
            // scale as much as is needed for the text
            iconSize: undefined,
            // the icon has a size of 25 x 41
            iconAnchor: [12, 41],
            // avoid white square
            className: '',
        });
    }

    function placePin() {
        const pin = getPinInput();
        if (pin === null) {
            console.log('invalid input');
            return;
        }
        L.marker([-pin.coords.z, pin.coords.x], {
            icon: createPinIcon(pin),
            title: pin.description,
        }).addTo(map);
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

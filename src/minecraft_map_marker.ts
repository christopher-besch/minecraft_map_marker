// from MinedMap
declare var createMap: () => Promise<[L.Map, L.Layer]>;

///////////
// types //
///////////
type NetherCoords = {
    x: number;
    y: number | null;
    z: number;
    __brand: 'NetherCoords';
}
type OverworldCoords = {
    x: number;
    y: number | null;
    z: number;
    __brand: 'OverworldCoords';
}

type Pin = {
    coords: OverworldCoords;
    title: string;
    description: string;
}
enum PinType {
    UserPin,
    ConstPin,
}

namespace Coords {
    export function netherToOverworldCoords(coords: NetherCoords): OverworldCoords {
        return { x: coords.x * 8, y: coords.y, z: coords.z * 8, __brand: 'OverworldCoords' };
    }
    export function overworldToNetherCoords(coords: OverworldCoords): NetherCoords {
        return { x: Math.round(coords.x / 8), y: coords.y, z: Math.round(coords.z / 8), __brand: 'NetherCoords' };
    }

    export function overworldCoordsToLeaflet(coords: OverworldCoords): L.LatLngExpression {
        return [-coords.z, coords.x];
    }
}

namespace Pins {
    const PIN_STORAGE_ID = 'pins';

    let map: L.Map;

    // lookup of each user pin's leaflet marker
    let leaflet_user_pins: Map<Pin, L.Marker> = new Map();
    // lookup of each const pin's leaflet marker
    let leaflet_const_pins: Map<Pin, L.Marker> = new Map();

    // the current coordinate input is reflected with this pin
    // it isn't stored and thus temporary
    let temp_marker = L.marker([0, 0]);
    // the layer for the leaflet pin markers created by the user
    let leaflet_user_pin_group = L.layerGroup([]);
    // the layer for the leaflet pin markers set by the server
    // the user can't change these, except for hiding all
    let leaflet_const_pin_group = L.layerGroup([]);

    export function getUserPins(): Pin[] {
        const raw_pins = localStorage.getItem(PIN_STORAGE_ID);
        if (raw_pins === null)
            return [];
        return JSON.parse(raw_pins);
    }
    function setUserPins(pins: Pin[]) {
        localStorage.setItem(PIN_STORAGE_ID, JSON.stringify(pins));
    }
    function syncUserPinStorage() {
        setUserPins(Array.from(leaflet_user_pins.keys()));
    }
    export function getConstPins(): Pin[] {
        // TODO: implement
        return [];
    }

    function addPinToMap(pin: Pin, pin_type: PinType) {
        if (getLeafletPin(pin, pin_type) !== undefined) {
            console.log(`can't create the same pin twice: ${pin} ${pin_type}`);
            return;
        }
        function createPinIcon(pin: Pin): L.DivIcon {
            const icon_path = './vendor/leaflet/images/marker-icon.png';

            let title = document.createElement('h3');
            title.textContent = pin.title;
            title.className = 'pin-title';

            let img = document.createElement('img');
            img.src = icon_path;
            img.className = 'pin-img';


            let icon_div = document.createElement('div');
            icon_div.appendChild(img);
            icon_div.className = 'pin';
            icon_div.appendChild(title);

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

        let marker = L.marker(Coords.overworldCoordsToLeaflet(pin.coords), {
            icon: createPinIcon(pin),
            title: pin.description,
        });
        switch (pin_type) {
            case PinType.UserPin:
                marker.addTo(leaflet_user_pin_group);
                leaflet_user_pins.set(pin, marker);
                break;
            case PinType.ConstPin:
                marker.addTo(leaflet_const_pin_group);
                leaflet_const_pins.set(pin, marker);
                break;
        }
        PinList.addPinItem(pin, pin_type);
    }

    export function setTempPinCoords(coords: OverworldCoords) {
        temp_marker.setLatLng(Coords.overworldCoordsToLeaflet(coords));
    }

    export function saveUserPin(pin: Pin) {
        addPinToMap(pin, PinType.UserPin);
        syncUserPinStorage();
        focusPin(pin);
    }

    function getLeafletPin(pin: Pin, pin_type: PinType): L.Marker | undefined {
        leaflet_user_pins.get(pin);

        switch (pin_type) {
            case PinType.UserPin:
                return leaflet_user_pins.get(pin);
            case PinType.ConstPin:
                return leaflet_const_pins.get(pin);
        }
    }

    export function focusPin(pin: Pin) {
        map.flyTo(Coords.overworldCoordsToLeaflet(pin.coords), 0.25);
    }
    export function deleteUserPin(pin: Pin) {
        let leaflet_pin = getLeafletPin(pin, PinType.UserPin);
        if (leaflet_pin === undefined) {
            console.error(`can't delete user pin of without a leaflet pin: ${pin}`);
            return;
        }
        leaflet_pin.removeFrom(map);
        leaflet_user_pins.delete(pin);
        syncUserPinStorage();
    }

    export function initialize(p_map: L.Map) {
        map = p_map;

        getUserPins().forEach(pin => { addPinToMap(pin, PinType.UserPin); });
        getConstPins().forEach(pin => { addPinToMap(pin, PinType.ConstPin); });

        temp_marker.addTo(map);
        leaflet_user_pin_group.addTo(map);
        leaflet_const_pin_group.addTo(map);
        TempPinInput.setTempCoords({ x: 0, y: null, z: 0, __brand: 'OverworldCoords' });
    }
    export function getControlLayers(): { [id: string]: L.Layer } {
        return { 'Pins': leaflet_user_pin_group, 'Default Pins': leaflet_const_pin_group };
    }
}

namespace PinList {
    let pin_list = document.getElementById('pin-list') as HTMLDivElement;

    // lookup of each user pin's item
    let user_pin_items: Map<Pin, HTMLDivElement> = new Map();
    // lookup of each const pin's item
    let const_pin_items: Map<Pin, HTMLDivElement> = new Map();

    function deleteUserPin(pin: Pin) {
        let pin_item = user_pin_items.get(pin);
        if (pin_item === undefined) {
            console.error(`can't delete user pin of without a pin item: ${pin}`);
            return;
        }
        pin_list.removeChild(pin_item);
    }

    export function addPinItem(pin: Pin, pin_type: PinType) {
        let overworld_coords = pin.coords;
        let nether_coords = Coords.overworldToNetherCoords(overworld_coords);

        let pin_coordinates = document.createElement('div');
        pin_coordinates.classList.add('pin-coordinates');
        pin_coordinates.innerHTML = `
        <div>Overworld</div>
        <div>${overworld_coords.x}</div>
        <div>${overworld_coords.y === null ? '~' : overworld_coords.y}</div>
        <div>${overworld_coords.z}</div>

        <div>Nether</div>
        <div>${nether_coords.x}</div>
        <div>${nether_coords.y === null ? '~' : nether_coords.y}</div>
        <div>${nether_coords.z}</div>
        `;

        let title = document.createElement('h3');
        title.textContent = pin.title;

        let description = document.createElement('p');
        description.classList.add('pin-description');
        description.textContent = pin.description;

        let pin_content = document.createElement('div');
        pin_content.classList.add('pin-content');
        pin_content.appendChild(title);
        pin_content.appendChild(pin_coordinates);
        pin_content.appendChild(description);

        let delete_button = document.createElement('button');
        delete_button.textContent = "delete";
        if (pin_type == PinType.UserPin) {
            delete_button.addEventListener('click', (e) => {
                e.stopPropagation();
                Pins.deleteUserPin(pin);
                deleteUserPin(pin);
            });
        }

        let pin_buttons = document.createElement('div');
        pin_buttons.classList.add('pin-buttons');
        pin_buttons.appendChild(delete_button);

        let pin_item = document.createElement('div');
        pin_item.classList.add('pin-item');
        pin_item.tabIndex = 0;
        pin_item.appendChild(pin_content);
        pin_item.appendChild(pin_buttons);

        pin_item.addEventListener('click', () => {
            console.log('click');
            Pins.focusPin(pin);
            TempPinInput.setTempPin(pin);
        });

        switch (pin_type) {
            case PinType.UserPin:
                user_pin_items.set(pin, pin_item);
                break;
            case PinType.ConstPin:
                const_pin_items.set(pin, pin_item);
                break;
        }

        pin_list.appendChild(pin_item);
        // don't use scrollIntoView as that scroll the entire page
        pin_list.scrollTo({ top: pin_item.offsetTop, behavior: 'smooth' })
    }
}

namespace TempPinInput {
    let overworld_x_field = document.getElementById('overworld-x') as HTMLInputElement;
    let overworld_z_field = document.getElementById('overworld-z') as HTMLInputElement
    let nether_x_field = document.getElementById('nether-x') as HTMLInputElement;
    let nether_z_field = document.getElementById('nether-z') as HTMLInputElement
    let height_field = document.getElementById('height') as HTMLInputElement
    let title_field = document.getElementById('title') as HTMLInputElement
    let description_field = document.getElementById('description') as HTMLInputElement
    let save_pin_button = document.getElementById('save-pin') as HTMLButtonElement;

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
        if (isNaN(x) || isNaN(z)) {
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
        if (isNaN(x) || isNaN(z)) {
            return null;
        }
        return { x, y: getHeightInput(), z, __brand: 'NetherCoords' };
    }
    function getTempPin(): Pin | null {
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

        return { coords, title, description };
    }

    export function setTempCoords(overworld_coords: OverworldCoords) {
        const nether_coords = Coords.overworldToNetherCoords(overworld_coords);
        overworld_x_field.value = String(overworld_coords.x);
        overworld_z_field.value = String(overworld_coords.z);
        nether_x_field.value = String(nether_coords.x);
        nether_z_field.value = String(nether_coords.z);
        height_field.value = overworld_coords.y === null ? '' : String(overworld_coords.y);

        Pins.setTempPinCoords(overworld_coords);
    }

    export function setTempPin(pin: Pin) {
        setTempCoords(pin.coords);
        title_field.value = pin.title;
        description_field.value = pin.description;
    }

    export function initialize() {
        function updateCoordsFromOverworld() {
            const coords = getOverworldCoordsInput();
            if (coords === null)
                return;
            setTempCoords(coords);
        }
        function updateCoordsFromNether() {
            const coords = getNetherCoordsInput();
            if (coords === null)
                return;
            setTempCoords(Coords.netherToOverworldCoords(coords));
        }

        // only these fields change other things
        // all other fields only affect things when then `Save Pin` button is clicked
        overworld_x_field.addEventListener('keyup', updateCoordsFromOverworld);
        overworld_z_field.addEventListener('keyup', updateCoordsFromOverworld);
        nether_x_field.addEventListener('keyup', updateCoordsFromNether);
        nether_z_field.addEventListener('keyup', updateCoordsFromNether);

        function savePinFromTemp() {
            const pin = getTempPin();
            if (pin === null) {
                console.log("temp pin is invalid; can't save");
                return;
            }
            Pins.saveUserPin(pin);
        }
        save_pin_button.addEventListener('click', savePinFromTemp);
    }
}

const initialize = async () => {
    const [map, light_layer] = await createMap();
    Pins.initialize(map);
    L.control.layers({}, Object.assign({}, { 'Illumination': light_layer }, Pins.getControlLayers())).addTo(map);

    map.on('click', function(e) {
        TempPinInput.setTempCoords({ x: Math.round(e.latlng.lng), y: null, z: Math.round(-e.latlng.lat), __brand: 'OverworldCoords' });
    });

    TempPinInput.initialize();
}

initialize();

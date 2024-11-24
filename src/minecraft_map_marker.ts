// from MinedMap
declare var createMap: () => Promise<[L.Map, L.Layer]>;

// differentiating between nether and overworld coordinates makes things a lot safer
type OverworldCoords = {
    x: number;
    y: number | null;
    z: number;
    __brand: 'OverworldCoords';
}
type NetherCoords = {
    x: number;
    y: number | null;
    z: number;
    __brand: 'NetherCoords';
}

// a pin as it is stored in the local storage or retrieved from the server
// const pins and user pins aren't differentiated here
type Pin = {
    coords: OverworldCoords;
    title: string;
    description: string;
}
// if a pin is a user or const pin is stored with this enum outside the pin struct
enum PinType {
    UserPin,
    ConstPin,
}

// coordinate calculations
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

// controlling pins on the leaflet map and store and retrieve pins to local storage and server
// call initialize() before anything else
namespace Pins {
    // used for the local storage
    const PIN_STORAGE_ID = 'pins';

    // the leaflet map
    let map: L.Map;

    // lookup of each user pin's leaflet marker
    let leaflet_user_pins: Map<string, L.Marker> = new Map();
    // lookup of each const pin's leaflet marker
    let leaflet_const_pins: Map<string, L.Marker> = new Map();

    // the current coordinate input is reflected with this pin
    // it isn't stored and thus temporary
    let temp_marker = L.marker([0, 0]);
    // the layer for the leaflet pin markers created by the user
    let leaflet_user_pin_group = L.layerGroup([]);
    // the layer for the leaflet pin markers set by the server
    // the user can't delete these, except for hiding all
    let leaflet_const_pin_group = L.layerGroup([]);

    // take something and return it if it's a lit of pins
    // return an empty list otherwise
    export function toPinList(pins: any): Pin[] {
        if (!Array.isArray(pins)) {
            console.error(`trying to load non-array data: `);
            console.error(pins);
            return [];
        }
        if (!pins.every(pin => {
            // TODO: check pin is actualy of type Pin
            return typeof pin === 'object';
        })) {
            console.error(`trying to load non-pin data: `);
            console.error(pins);
            return [];
        }
        return pins;
    }

    // retrieve user pins from local storage
    export function getUserPins(): Pin[] {
        const raw_pins = localStorage.getItem(PIN_STORAGE_ID);
        if (raw_pins === null)
            return [];
        return toPinList(JSON.parse(raw_pins));
    }
    // push changes in leaflet_user_pins to local storage
    function syncUserPinStorage() {
        // store pins in local storage
        function setUserPins(pins: Pin[]) {
            localStorage.setItem(PIN_STORAGE_ID, JSON.stringify(pins));
        }
        let pins_strings = Array.from(leaflet_user_pins.keys());
        let pins = pins_strings.map(function(pin_str) { return JSON.parse(pin_str) as Pin; });
        setUserPins(pins);
    }
    // retrieve const pins from the server
    export const getConstPins = async function(): Promise<Pin[]> {
        const pins = await fetch('./const_pins.json', { cache: 'no-store' }).then((resp) => {
            if (!resp.ok) {
                throw new Error(`fetch const_pins.json failed: ${resp.status}`);
            }
            return resp.json();
        });
        return toPinList(pins);
    }

    // Find a pin in the leaflet_user_pins or leaflet_const_pins map.
    function getLeafletPin(pin: Pin, pin_type: PinType): L.Marker | undefined {
        switch (pin_type) {
            case PinType.UserPin:
                return leaflet_user_pins.get(JSON.stringify(pin));
            case PinType.ConstPin:
                return leaflet_const_pins.get(JSON.stringify(pin));
        }
    }

    // Take a pin and create a new marker for it on the map.
    // There will be a key-value pair created in leaflet_user_pins or leaflet_const_pins.
    // Return true iff the pin hasn't been added to the map yet.
    // Return false otherwise.
    //
    // This function doesn't work for the temp pin and also doesn't store a pin item in the pin list.
    // 
    // Additionally this function doesn't sync the pins on the map with the local storage.
    // The caller is required to sync.
    function addPinToMap(pin: Pin, pin_type: PinType): boolean {
        if (getLeafletPin(pin, pin_type) !== undefined) {
            console.log(`can't create the same pin twice: `);
            console.log(pin);
            console.log(pin_type);
            return false;
        }
        function createPinIcon(pin: Pin): L.DivIcon {
            const icon_path = './vendor/leaflet/images/marker-icon.png';

            let title = document.createElement('h4');
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
                leaflet_user_pins.set(JSON.stringify(pin), marker);
                break;
            case PinType.ConstPin:
                marker.addTo(leaflet_const_pin_group);
                leaflet_const_pins.set(JSON.stringify(pin), marker);
                break;
        }
        return true;
    }

    // Move the temp pin to the specified coordinates.
    // This doesn't change the coordinates set in the temp user input.
    export function setTempPinCoords(coords: OverworldCoords) {
        temp_marker.setLatLng(Coords.overworldCoordsToLeaflet(coords));
    }

    // Create a new pin on the leaflet map, store it in the local storage and add a pin item to the pin list.
    export function saveUserPin(pin: Pin) {
        if (addPinToMap(pin, PinType.UserPin)) {
            syncUserPinStorage();
            PinList.addPinItem(pin, PinType.UserPin);
        }
        // Always focus the pin, even if it already existed before.
        PinList.focusPin(pin, PinType.UserPin);
        focusPin(pin);
    }

    // Move the map to that pin.
    // The pin doesn't have to have a marker on the leaflet map.
    export function focusPin(pin: Pin) {
        map.flyTo(Coords.overworldCoordsToLeaflet(pin.coords), 0.25);
    }

    // Delete the pin's marker from the leaflet map, remove it from the pin list and update the local storage.
    export function deleteUserPin(pin: Pin) {
        let leaflet_pin = getLeafletPin(pin, PinType.UserPin);
        if (leaflet_pin === undefined) {
            console.error(`can't delete user pin without a leaflet pin: `);
            console.error(pin);
            return;
        }
        leaflet_user_pin_group.removeLayer(leaflet_pin);

        PinList.deleteUserPinFromPinList(pin);

        leaflet_user_pins.delete(JSON.stringify(pin));
        syncUserPinStorage();
    }

    // Add all the required layers to the map and initialize the pins.
    // This loads the pins from local storage and adds them to the pin list.
    //
    // You still need to add the control layers with the getControlLayers function.
    export function initialize(p_map: L.Map) {
        map = p_map;

        getUserPins().forEach(pin => {
            addPinToMap(pin, PinType.UserPin);
            PinList.addPinItem(pin, PinType.UserPin);
        });
        getConstPins().then((pins) => {
            pins.forEach(pin => {
                addPinToMap(pin, PinType.ConstPin);
                PinList.addPinItem(pin, PinType.ConstPin);
            })
        });

        temp_marker.addTo(map);
        leaflet_user_pin_group.addTo(map);
        leaflet_const_pin_group.addTo(map);
        TempPinInput.setTempCoords({ x: 0, y: null, z: 0, __brand: 'OverworldCoords' });
    }

    // There might be other control layers so we don't just add these to the map in the initialize function.
    // Use this function to do that however you like.
    export function getControlLayers(): { [id: string]: L.Layer } {
        return { 'User Pins': leaflet_user_pin_group, 'Const Pins': leaflet_const_pin_group };
    }
}

namespace PinList {
    let pin_list = document.getElementById('pin-list') as HTMLDivElement;
    let export_all_button = document.getElementById('export-all') as HTMLButtonElement;
    let import_button = document.getElementById('import') as HTMLButtonElement;

    // lookup of each user pin's item
    let user_pin_items: Map<string, HTMLDivElement> = new Map();
    // lookup of each const pin's item
    let const_pin_items: Map<string, HTMLDivElement> = new Map();

    // Delete the pin from the pin list.
    // Don't remove it from the map or update the local storage.
    export function deleteUserPinFromPinList(pin: Pin) {
        let pin_item = user_pin_items.get(JSON.stringify(pin));
        if (pin_item === undefined) {
            console.error(`can't delete user pin of without a pin item: `);
            console.error(pin);
            return;
        }
        pin_list.removeChild(pin_item);
        user_pin_items.delete(JSON.stringify(pin));
    }

    function setButtonMsg(button: HTMLButtonElement, msg: string) {
        const default_text = button.textContent;
        const default_disabled = button.disabled;
        button.disabled = true;
        button.textContent = msg;
        setTimeout(() => {
            button.textContent = default_text;
            button.disabled = default_disabled;
        }, 2500);
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
        switch (pin_type) {
            case PinType.UserPin:
                delete_button.textContent = "Delete";
                delete_button.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // move the temp marker to the to be deleted pin
                    // (in case the deletion was a mistake the coordinates aren't lost)
                    TempPinInput.setTempPin(pin);

                    Pins.deleteUserPin(pin);
                });
                break;
            case PinType.ConstPin:
                delete_button.textContent = "Const Pins can't be deleted";
                delete_button.disabled = true;
                break;
        }

        let export_button = document.createElement('button');
        export_button.textContent = "Export";
        export_button.addEventListener('click', async (e) => {
            e.stopPropagation();

            try {
                await exportPinsToClipboard([pin]);
            } catch {
                setButtonMsg(export_button, 'Clipboard denied!');
                return;
            }
            setButtonMsg(export_button, 'Copied to Clipboard');
        });

        let pin_buttons = document.createElement('div');
        pin_buttons.classList.add('pin-buttons');
        pin_buttons.appendChild(delete_button);
        pin_buttons.appendChild(export_button);

        let pin_item = document.createElement('div');
        pin_item.classList.add('pin-item');
        pin_item.tabIndex = 0;
        pin_item.appendChild(pin_content);
        pin_item.appendChild(pin_buttons);

        pin_item.addEventListener('click', () => {
            Pins.focusPin(pin);
            TempPinInput.setTempPin(pin);
        });

        switch (pin_type) {
            case PinType.UserPin:
                user_pin_items.set(JSON.stringify(pin), pin_item);
                break;
            case PinType.ConstPin:
                const_pin_items.set(JSON.stringify(pin), pin_item);
                break;
        }

        pin_list.appendChild(pin_item);
    }

    export function focusPin(pin: Pin, pin_type: PinType) {
        let pin_item: HTMLDivElement | undefined;
        switch (pin_type) {
            case PinType.UserPin:
                pin_item = user_pin_items.get(JSON.stringify(pin));
                break;
            case PinType.ConstPin:
                pin_item = const_pin_items.get(JSON.stringify(pin));
                break;
        }
        if (pin_item === undefined) {
            console.error(`can't focus a pin without a pin item: `);
            console.error(pin);
            return;
        }
        // don't use scrollIntoView as that scrolls the entire page
        pin_list.scrollTo({ top: pin_item.offsetTop - pin_list.offsetTop, behavior: 'smooth' })
    }

    const importPinsFromClipboard = async function() {
        const text = await navigator.clipboard.readText();
        const pins = Pins.toPinList(JSON.parse(text));
        pins.forEach(Pins.saveUserPin);
    }

    const exportPinsToClipboard = async function(pins: Pin[]) {
        await navigator.clipboard.writeText(JSON.stringify(pins));
    }

    export function initialize() {
        export_all_button.addEventListener('click', async () => {
            try {
                await exportPinsToClipboard(Pins.getUserPins());
            } catch {
                setButtonMsg(export_all_button, 'Clipboard denied!');
                return;
            }
            setButtonMsg(export_all_button, 'Copied to Clipboard');
        });
        import_button.addEventListener('click', async () => {
            try {
                await importPinsFromClipboard();
            } catch {
                setButtonMsg(import_button, 'Failed to Import!');
            }
        });
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
            title_field.value = '';
            description_field.value = '';
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
    PinList.initialize();
}

initialize();

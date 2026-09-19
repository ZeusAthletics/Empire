export const MISSION_PLANNER_VERSION = "mission-planner@1";

export const MISSION_PLANNER = `Produce structured mission strategy JSON. Do not invent restricted contacts. Do not write presentation copy.
locationAddress must be a real Belgian street address: street name + house number + municipality (Kempen or nearby). Example: "Lambertzlaan 10, 2440 Geel". Never only a town name. Never "online". Never invent a street.
locationName is the venue or short label. The server geocodes locationAddress and places the map pin on that exact address.
lat/lng are optional; the server looks the address up. If the address cannot be found, omit coordinates rather than guessing.
people must be existing contact names or seed keys. Never invent people.`;

import { defineTool } from "eve/tools";
import { z } from "zod";

// Real weather via Open-Meteo — free, no API key, plain fetch (matches the
// zero-dep style of lib/). Geocodes the city, then pulls current conditions
// and a short daily forecast for trip planning.

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// WMO weather interpretation codes → plain words.
const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

const describe = (code: number | undefined) => (code === undefined ? "Unknown" : (WMO[code] ?? `Code ${code}`));

export default defineTool({
  description:
    "Get current weather and a daily forecast (up to 7 days) for a city. Use for trip planning and 'what's the weather' questions.",
  inputSchema: z.object({
    city: z.string().min(1).describe("City name, optionally with region/country, e.g. 'Denver' or 'Paris, France'."),
    days: z.number().int().min(1).max(7).optional().describe("Forecast days to include (default 3)."),
  }),
  async execute({ city, days }) {
    try {
      const geoRes = await fetch(
        `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!geoRes.ok) return { error: `Geocoding failed: ${geoRes.status}` };
      const geo = (await geoRes.json()) as {
        results?: Array<{ name: string; latitude: number; longitude: number; admin1?: string; country?: string; timezone?: string }>;
      };
      const place = geo.results?.[0];
      if (!place) return { error: `Couldn't find a place called "${city}".` };

      const params = new URLSearchParams({
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        temperature_unit: "fahrenheit",
        wind_speed_unit: "mph",
        timezone: place.timezone ?? "auto",
        forecast_days: String(days ?? 3),
      });
      const res = await fetch(`${FORECAST_URL}?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { error: `Forecast failed: ${res.status}` };
      const data = (await res.json()) as {
        current: {
          temperature_2m: number;
          apparent_temperature: number;
          precipitation: number;
          weather_code: number;
          wind_speed_10m: number;
        };
        daily: {
          time: string[];
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_probability_max: (number | null)[];
        };
      };

      return {
        place: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
        current: {
          condition: describe(data.current.weather_code),
          temperatureF: Math.round(data.current.temperature_2m),
          feelsLikeF: Math.round(data.current.apparent_temperature),
          windMph: Math.round(data.current.wind_speed_10m),
          precipitationIn: data.current.precipitation,
        },
        daily: data.daily.time.map((date, i) => ({
          date,
          condition: describe(data.daily.weather_code[i]),
          highF: Math.round(data.daily.temperature_2m_max[i]),
          lowF: Math.round(data.daily.temperature_2m_min[i]),
          precipChancePct: data.daily.precipitation_probability_max[i] ?? undefined,
        })),
      };
    } catch (e) {
      return { error: `Weather lookup failed: ${(e as Error).message}` };
    }
  },
});

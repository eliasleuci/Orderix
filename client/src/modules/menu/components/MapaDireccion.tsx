import React, { useCallback, useRef, useState } from 'react';
import { Autocomplete, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { LocateFixed, Search } from 'lucide-react';

// Una sola declaración de librerías para todo el módulo: pasar un array nuevo
// en cada render hace que useJsApiLoader recargue el script de Google entero.
const LIBRERIAS: 'places'[] = ['places'];

// Buenos Aires como centro por default: sólo se ve si el navegador todavía no
// dio ninguna posición (ni GPS, ni dirección tipeada, ni pin previo).
const CENTRO_INICIAL = { lat: -34.6037, lng: -58.3816 };

interface Coordenadas {
  lat: number;
  lng: number;
}

interface Props {
  direccion: string;
  onDireccionChange: (direccion: string) => void;
  coordenadas: Coordenadas | null;
  onCoordenadasChange: (coords: Coordenadas | null) => void;
}

const campo =
  'w-full bg-surface-base border border-white/10 rounded-2xl h-12 pl-11 pr-4 text-text-primary text-sm focus:outline-none focus:border-primary';

const MapaDireccion: React.FC<Props> = ({ direccion, onDireccionChange, coordenadas, onCoordenadasChange }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? '',
    libraries: LIBRERIAS,
  });

  const [buscando, setBuscando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const geocoder = useCallback(() => {
    if (!geocoderRef.current && isLoaded) geocoderRef.current = new google.maps.Geocoder();
    return geocoderRef.current;
  }, [isLoaded]);

  // Al arrastrar el pin no hay forma de saber la calle: se la pide a Google y
  // se pisa el texto de la dirección, para que loguen siempre coincidan.
  const reverseGeocode = useCallback(
    (coords: Coordenadas) => {
      const g = geocoder();
      if (!g) return;
      g.geocode({ location: coords }, (resultados, status) => {
        if (status === 'OK' && resultados?.[0]) onDireccionChange(resultados[0].formatted_address);
      });
    },
    [geocoder, onDireccionChange]
  );

  const usarMiUbicacion = () => {
    setErrorUbicacion(null);
    if (!navigator.geolocation) {
      setErrorUbicacion('Tu navegador no puede compartir la ubicación');
      return;
    }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onCoordenadasChange(coords);
        reverseGeocode(coords);
        setBuscando(false);
      },
      () => {
        setErrorUbicacion('No pudimos acceder a tu ubicación. Marcala en el mapa o escribila.');
        setBuscando(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onLugarSeleccionado = () => {
    const lugar = autocompleteRef.current?.getPlace();
    const loc = lugar?.geometry?.location;
    if (!loc) return;
    onCoordenadasChange({ lat: loc.lat(), lng: loc.lng() });
    onDireccionChange(lugar.formatted_address ?? direccion);
  };

  const onArrastrarPin = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    onCoordenadasChange(coords);
    reverseGeocode(coords);
  };

  // Sin API key configurada, se degrada al campo de texto de siempre: mejor
  // eso que romper el checkout entero si falta la variable de entorno.
  if (!apiKey) {
    return (
      <input
        className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-text-primary text-sm focus:outline-none focus:border-primary"
        placeholder="Calle y número"
        value={direccion}
        onChange={(e) => onDireccionChange(e.target.value)}
      />
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-12 rounded-2xl bg-surface-base border border-white/10 animate-pulse" />
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
        <Autocomplete
          onLoad={(a) => (autocompleteRef.current = a)}
          onPlaceChanged={onLugarSeleccionado}
          options={{ componentRestrictions: { country: 'ar' } }}
        >
          <input
            className={campo}
            placeholder="Calle y número"
            value={direccion}
            onChange={(e) => onDireccionChange(e.target.value)}
          />
        </Autocomplete>
      </div>

      <button
        type="button"
        onClick={usarMiUbicacion}
        disabled={buscando}
        className="w-full h-11 rounded-2xl border border-white/10 bg-surface-base text-xs font-black uppercase tracking-widest text-text-secondary inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <LocateFixed size={15} />
        {buscando ? 'Buscando tu ubicación...' : 'Usar mi ubicación actual'}
      </button>

      {errorUbicacion && <p className="text-xs text-danger">{errorUbicacion}</p>}

      <div className="rounded-2xl overflow-hidden border border-white/10">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '180px' }}
          center={coordenadas ?? CENTRO_INICIAL}
          zoom={coordenadas ? 16 : 12}
          onClick={onArrastrarPin}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy',
          }}
        >
          {coordenadas && (
            <Marker position={coordenadas} draggable onDragEnd={onArrastrarPin} />
          )}
        </GoogleMap>
      </div>
      {coordenadas && (
        <p className="text-[11px] text-text-muted text-center">
          Arrastrá el pin si el punto exacto no es ese
        </p>
      )}
    </div>
  );
};

export default MapaDireccion;

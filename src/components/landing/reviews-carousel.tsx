"use client";

import { useEffect, useRef } from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const reviews = [
  {
    name: "Martín L.",
    role: "Desarrollador independiente",
    text: "Recupere mas de $180.000 en deducciones que ni sabia que podia cargar. En 10 minutos estaba todo en SiRADIG.",
  },
  {
    name: "Carolina S.",
    role: "Contadora",
    text: "Se lo recomiendo a todos mis clientes. Les ahorra horas de carga manual y a mi me simplifica el seguimiento.",
  },
  {
    name: "Federico R.",
    role: "Empleado en relacion de dependencia",
    text: "Todos los años me olvidaba de cargar las facturas. Ahora subo los PDFs y desgrava.ar hace el resto.",
  },
  {
    name: "Lucía M.",
    role: "Medica",
    text: "La automatizacion con clave fiscal me parecio increible. Cero contacto con la pagina de ARCA.",
  },
  {
    name: "Santiago P.",
    role: "Ingeniero",
    text: "El simulador me mostro que estaba dejando $95.000 en la mesa. Al otro dia ya tenia todo cargado.",
  },
  {
    name: "Valentina G.",
    role: "Disenadora grafica",
    text: "Nunca habia usado ARCA en mi vida. Subi las facturas y la IA detecto sola en que categoria iba cada una. No tuve que googlear nada.",
  },
];

export function ReviewsCarousel() {
  const autoplayRef = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false })
  );

  useEffect(() => {
    return () => {
      autoplayRef.current.stop();
    };
  }, []);

  return (
    <Carousel
      opts={{ align: "start", loop: true }}
      plugins={[autoplayRef.current]}
      className="w-full"
      onMouseEnter={() => autoplayRef.current.stop()}
      onMouseLeave={() => autoplayRef.current.play()}
    >
      <CarouselContent className="-ml-6">
        {reviews.map((review) => (
          <CarouselItem
            key={review.name}
            className="pl-6 basis-full md:basis-1/2 lg:basis-1/3"
          >
            <div className="h-full flex flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-900">
                  {review.name}
                </p>
                <p className="text-[11px] text-gray-400">{review.role}</p>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

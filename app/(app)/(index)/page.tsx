import { Link } from "react-router";
import { BLAMEJA_ROUTES } from "app/routes";
import {
  FaShoppingCart, // продажба
  FaTruckLoading, // прием
  FaBoxes, // залиха
  FaChartLine, // финансии
} from "react-icons/fa";

const cards = [
  
  {
    title: "Продажба",
    description: "Продажба по баркод или шифра.",
    to: BLAMEJA_ROUTES.sales,
    color: "bg-blamejaOrange",
    icon: FaShoppingCart,
  },
  {
    title: "Прием на стока",
    description: "Внеси нови артикли и зголеми залиха.",
    to: BLAMEJA_ROUTES.receive,
    color: "bg-blamejaGreenDark",
    icon: FaTruckLoading,
  },
  {
    title: "Залиха",
    description: "Преглед на лагер и движења по артикл.",
    to: BLAMEJA_ROUTES.stock,
    color: "bg-blamejaOrange",
    icon: FaBoxes,
  },
  {
    title: "Финансии",
    description: "Промет и основни извештаи.",
    to: BLAMEJA_ROUTES.finance,
    color: "bg-blamejaGreen",
    icon: FaChartLine,
  },
] as const;

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto mt-8 px-4">
      <div className="text-center mb-6">
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-800">
          Што сакате да направите?
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Изберете модул за работа (продажба, прием, залиха, финансии…)
        </p>
      </div>

      <div className="grid gap-4 md:gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              className="block rounded-2xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow border border-slate-200"
            >
              <div className="flex">
                <div
                  className={`${card.color} w-24 flex flex-col items-center justify-center text-white font-bold gap-1`}
                >
                  <Icon className="w-7 h-7 md:w-8 md:h-8" />
                </div>

                <div className="flex-1 px-4 py-4">
                  <h2 className="text-xl font-semibold mb-1 text-slate-800">
                    {card.title}
                  </h2>
                  <p className="text-slate-600 text-sm">{card.description}</p>

                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-blamejaGreen" />
                    <span>Отвори модул</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 text-center text-xs text-slate-400">
        Совет: за побрза работа користете баркод скенер (USB) или камера за QR.
      </div>
    </div>
  );
}

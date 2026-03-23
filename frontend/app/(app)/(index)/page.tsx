import { Link } from 'react-router';
import { BLAMEJA_ROUTES } from 'app/routes';
import {
	FaShoppingCart,
	FaTruckLoading,
	FaBoxes,
	FaClipboardList,
} from 'react-icons/fa';

const cards = [
	{
		title: 'Продажба',
		sub: 'Баркод · Шифра · Каса',
		to: BLAMEJA_ROUTES.sales,
		bg: 'bg-blamejaOrange',
		icon: FaShoppingCart,
	},
	{
		title: 'Прием на стока',
		sub: 'Артикли · Добавувачи · Залиха',
		to: BLAMEJA_ROUTES.receive,
		bg: 'bg-blamejaGreenDark',
		icon: FaTruckLoading,
	},
	{
		title: 'Залиха',
		sub: 'Лагер · Движења · Цени',
		to: BLAMEJA_ROUTES.stock,
		bg: 'bg-blamejaGreen',
		icon: FaBoxes,
	},
	{
		title: 'Испратница',
		sub: 'Документи',
		to: BLAMEJA_ROUTES.dispatch,
		bg: 'bg-slate-700',
		icon: FaClipboardList,
	},
] as const;

const HomePage = () => {
	return (
		<div className="pt-4 sm:pt-6 grid grid-cols-2 gap-3 sm:gap-4 h-[calc(100dvh-200px)]">
			{cards.map((card) => {
				const Icon = card.icon;
				return (
					<Link
						key={card.to}
						to={card.to}
						className={`${card.bg} relative flex flex-col items-center justify-center gap-3
							rounded-3xl text-white overflow-hidden h-full shadow-lg
							active:scale-[0.97] hover:brightness-110
							transition-all duration-150 ease-in-out
							select-none touch-manipulation
							p-4 sm:p-6`}
					>
						{/* Corner accent blob */}
						<div className="absolute top-0 left-0 w-24 h-24 rounded-full bg-white/5 -translate-x-8 -translate-y-8 pointer-events-none" />

						{/* Large faded background icon */}
						<Icon className="absolute right-4 bottom-3 w-24 h-24 text-white/[0.07] pointer-events-none" />

						{/* Icon badge */}
						<div className="relative z-10 flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
							<Icon className="w-6 h-6 sm:w-8 sm:h-8" />
						</div>

						{/* Title + subtitle */}
						<div className="relative z-10 text-center">
							<h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight">
								{card.title}
							</h2>
							<p className="text-[11px] sm:text-sm text-white/65 mt-1 font-medium tracking-wide">
								{card.sub}
							</p>
						</div>
					</Link>
				);
			})}
		</div>
	);
};

export default HomePage;

import { Link } from 'react-router';
import { BLAMEJA_ROUTES } from 'app/routes';
import {
	FaShoppingCart,
	FaTruckLoading,
	FaBoxes,
	FaClipboardList,
	FaFileInvoiceDollar,
} from 'react-icons/fa';

// ─── Row 1: three main actions ────────────────────────────────────────────────
const topCards = [
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
] as const;

// ─── Row 2: two secondary actions ────────────────────────────────────────────
const bottomCards = [
	{
		title: 'Испратница',
		sub: 'Документи',
		to: BLAMEJA_ROUTES.dispatch,
		bg: 'bg-slate-700',
		icon: FaClipboardList,
	},
	{
		title: 'Сторно',
		sub: 'Фискални сметки · Поврат',
		to: BLAMEJA_ROUTES.fiscalReceipts,
		bg: 'bg-red-700',
		icon: FaFileInvoiceDollar,
	},
] as const;

// ─── Shared card renderer ─────────────────────────────────────────────────────

type CardDef = {
	title: string;
	sub: string;
	to: string;
	bg: string;
	icon: React.ComponentType<{ className?: string }>;
};

const NavCard = ({ card }: { card: CardDef }) => {
	const Icon = card.icon;
	return (
		<Link
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
			<div className="relative z-10 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
				<Icon className="w-6 h-6 sm:w-7 sm:h-7" />
			</div>

			{/* Title + subtitle */}
			<div className="relative z-10 text-center">
				<h2 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight leading-tight">
					{card.title}
				</h2>
				<p className="text-[10px] sm:text-xs text-white/65 mt-1 font-medium tracking-wide">
					{card.sub}
				</p>
			</div>
		</Link>
	);
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const HomePage = () => (
	<div className="pt-4 sm:pt-6 flex flex-col gap-3 sm:gap-4 h-[calc(100dvh-200px)]">
		{/* Row 1 — three cards, taller */}
		<div className="grid grid-cols-3 gap-3 sm:gap-4 flex-[3]">
			{topCards.map((card) => <NavCard key={card.to} card={card} />)}
		</div>

		{/* Row 2 — two cards, shorter */}
		<div className="grid grid-cols-2 gap-3 sm:gap-4 flex-[2]">
			{bottomCards.map((card) => <NavCard key={card.to} card={card} />)}
		</div>
	</div>
);

export default HomePage;

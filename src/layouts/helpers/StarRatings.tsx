import React from "react";
import { MdOutlineStar, MdOutlineStarBorder, MdOutlineStarHalf } from "react-icons/md";

interface StarRatingsProps {
	stars: number;
}

const StarRatings: React.FC<StarRatingsProps> = ({ stars }) => {
	const filledStars = Math.floor(stars); // Number of full stars
	const hasHalfStar = stars % 1 >= 0.5; // Check if there's a half star
	const emptyStars = 5 - filledStars - (hasHalfStar ? 1 : 0); // Number of empty stars

	const filled = Array(filledStars).fill(" ");
	const halfFilled = hasHalfStar ? ["half"] : []; // Array for half-filled star
	const empty = Array(emptyStars).fill(" ");

	return (
		<div className="flex items-center">
			{/* Render filled stars */}
			{filled.map((elem, index) => (
				<MdOutlineStar
					key={index}
					className="text-[#FACC15] text-2xl"
				/>
			))}
			{/* Render half-filled star */}
			{halfFilled.map((elem, index) => (
				<MdOutlineStarHalf
					key={filled.length}
					className="text-[#FACC15] text-2xl"
				/>
			))}
			{/* Render empty stars */}
			{empty.map((elem, index) => (
				<MdOutlineStarBorder
					key={filled.length + halfFilled.length + index}
					className="text-[#FACC15] text-2xl"
				/>
			))}
		</div>
	);
};

export default StarRatings;

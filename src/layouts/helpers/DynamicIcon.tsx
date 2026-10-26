import React, { type FC } from "react";
import type { IconType } from "react-icons";
import * as FaIcons from "react-icons/fa6";
// import * as AiIcons from "react-icons/ai";
// import * as BsIcons from "react-icons/bs";
// import * as FiIcons from "react-icons/fi";
// import * as Io5Icons from "react-icons/io5";
// import * as RiIcons from "react-icons/ri";
// import * as TbIcons from "react-icons/tb";
// import * as TfiIcons from "react-icons/tfi";

type IconMap = Record<string, IconType>;

interface IDynamicIcon extends React.SVGProps<SVGSVGElement> {
  icon: string;
  className?: string;
}

const iconLibraries: { [key: string]: IconMap } = {
  fa: FaIcons,
};

const DynamicIcon: FC<IDynamicIcon> = ({ icon, ...props }) => {
  // add a check for the icon prop
  if (!icon || typeof icon !== 'string') {
    console.warn('DynamicIcon: icon prop is required and must be a string');
    return <span className="text-sm">Invalid icon</span>;
  }

  const IconLibrary = getIconLibrary(icon);
  const Icon = IconLibrary ? IconLibrary[icon] : undefined;

  if (!Icon) {
    console.warn(`DynamicIcon: Icon "${icon}" not found`);
    return <span className="text-sm">Icon not found</span>;
  }

  return <Icon {...props} />;
};

const getIconLibrary = (icon: string): IconMap | undefined => {
  try {
    // Check if the icon name is at least 2 characters long
    // and convert the first two characters to lowercase
    // to match the keys in the iconLibraries object
    if (icon.length < 2) {
      console.warn('DynamicIcon: icon name must be at least 2 characters long');
      return undefined;
    }

    const libraryKey = icon.substring(0, 2).toLowerCase();
    return iconLibraries[libraryKey];
  } catch (error) {
    console.error('DynamicIcon: Error getting icon library:', error);
    return undefined;
  }
};

export default DynamicIcon;

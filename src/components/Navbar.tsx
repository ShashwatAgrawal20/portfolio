import { ArrowRightIcon } from "@heroicons/react/20/solid";
import { AiFillGithub, AiFillLinkedin } from "react-icons/ai";

const Navbar = () => {
    return (
        <header className="bg-gray-800 md:sticky top-0 z-10">
            <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center">
                <a href="#" className="title-font font-medium text-white mb-4 md:mb-0 md:ml-3 md:text-xl">
                    Shashwat Agrawal
                </a>
                <nav className="md:mr-auto md:ml-4 md:py-1 md:pl-4 md:border-l md:border-gray-700 flex flex-wrap items-center text-base justify-center">
                    <a href="#projects" className="mr-2 md:mr-5 hover:text-white">
                        Past Work
                    </a>
                    <a href="#skills" className="mr-2 md:mr-5 hover:text-white">
                        Skills
                    </a>
                </nav>
                <div className="flex py-2">
                    <a href="https://github.com/shashwatagrawal20" target="_blank" className="mr-2 md:mr-5 hover:text-white text-xl">
                        <AiFillGithub className="w-4 h-4 ml-1" />
                    </a>
                    <a href="https://www.linkedin.com/in/theshashwatagrawal/" target="_blank" className="mr-2 md:mr-5 hover:text-white text-xl">
                        <AiFillLinkedin className="w-4 h-4 ml-1" />
                    </a>
                </div>
                <a
                    href="#contact"
                    className="inline-flex items-center bg-gray-800 border-0 py-1 px-3 focus:outline-none hover:bg-gray-700 rounded text-base mt-4 md:mt-0">
                    Hire Me
                    <ArrowRightIcon className="w-4 h-4 ml-1" />
                </a>
            </div>
        </header>
    );
}

export default Navbar;

// import { BadgeCheckIcon, ChipIcon } from "@heroicons/react/solid";
import { CheckBadgeIcon, ChartPieIcon } from "@heroicons/react/20/solid";
import { skills } from "../data";

const Skills = () => {
    return (
        <section id="skills">
            <div className="container px-5 py-10 mx-auto">
                <div className="text-center mb-12">
                    <ChartPieIcon className="w-10 inline-block mb-4" />
                    <h1 className="sm:text-4xl text-3xl font-medium title-font text-white mb-4">
                        Skills &amp; Technologies
                    </h1>
                    <p className="text-base leading-relaxed xl:w-2/4 lg:w-3/4 mx-auto">
                        I have worked with a range of technologies in the web development world.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center items-center lg:w-4/5 sm:mx-auto sm:mb-2 -mx-2">
                    {skills.map((skill: string) => (
                        <div key={skill} className="p-2 sm:w-1/2 w-full">
                            <div className="bg-gray-800 rounded flex p-4 h-full items-center">
                                <CheckBadgeIcon className="text-green-400 w-6 h-6 flex-shrink-0 mr-4" />
                                <span className="title-font font-medium text-white">
                                    {skill}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Skills


import { CodeBracketIcon } from "@heroicons/react/24/outline"
import { projects } from "../data"

const Projects = () => {
    return (
        <section id="projects" className="text-gray-400 bg-gray-900 body-font">
            <div className="container px-5 py-10 mx-auto text-center lg:px-40">
                <div className="flex flex-col w-full mb-20">
                    <CodeBracketIcon className="mx-auto inline-block w-10 mb-4" />
                    <h1 className="sm:text-4xl text-3xl font-medium title-font mb-4 text-white">
                        Things I've Built
                    </h1>
                    <p className="lg:w-2/3 mx-auto leading-relaxed text-base">
                        These are some of the website, I have built using React, Next, Node, Express, MongoDB, MySQL, Django, and more.
                        All the projects are open source and available on my GitHub.
                    </p>
                </div>
                <div className="flex flex-wrap -m-4 justify-center items-center">
                    {projects.map((project) => (
                        <a href={project.link} key={project.title} target="_blank" className="sm:w-1/2 w-full p-4">
                            <div className="flex flex-col h-full border-4 border-gray-800 bg-gray-900">
                                <img
                                    alt="gallery"
                                    className="w-full h-auto object-cover object-center"
                                    src={project.image}
                                />
                                <div className="p-8">
                                    <h2 className="tracking-widest text-sm title-font font-medium text-green-400 mb-1">
                                        {project.subtitle}
                                    </h2>
                                    <h1 className="title-font text-lg font-medium text-white mb-3">
                                        {project.title}
                                    </h1>
                                    <p className="leading-relaxed">{project.description}</p>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Projects

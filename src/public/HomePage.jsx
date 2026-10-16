import { ArrowRight, Briefcase, Building2, Clock, MessageSquare, Sprout } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { EnquiryForm } from "./EnquiryForm";

const PROGRAMS = [
  {
    slug: "pre-incubation",
    icon: Sprout,
    name: "Pre-Incubation",
    audience: "Students, staff and early founders with an idea or prototype",
    description:
      "Shape your idea into a startup with mentoring, access to AIC MUJ's coworking space and facilities, and feedback from our evaluation panel.",
    needs: ["Pitch deck and business plan (PDF)", "Founder's resume (PDF)", "PAN card"],
    time: "About 20 minutes",
  },
  {
    slug: "incubation",
    icon: Building2,
    name: "Incubation",
    audience: "Startups with a proof of concept, prototype, MVP or early revenue",
    description:
      "Incubation, mentorship, networking and fundraising support for startups ready to grow, guided by the AIC MUJ team and panel.",
    needs: ["Startup and contact details", "Pitch deck (PDF, recommended)"],
    time: "About 10 minutes",
  },
  {
    slug: "internship",
    icon: Briefcase,
    name: "Internship",
    audience: "Students of Manipal University Jaipur",
    description:
      "Work with AIC MUJ-incubated startups in design, web development, marketing, content and more — remote, with flexible hours and an experience certificate.",
    needs: ["Course and year of study", "CV or portfolio (optional)"],
    time: "About 5 minutes",
  },
];

const STEPS = [
  { title: "Apply online", text: "Choose a program and complete the form. You'll get a reference number straight away." },
  { title: "Review and pitch", text: "Our team reviews every application. Shortlisted founders pitch to the evaluation panel." },
  { title: "Hear back by email", text: "We email you the decision and, if you're selected, how to get started." },
];

export function HomePage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  // The API sleeps when idle on free hosting; wake it while the visitor reads.
  useEffect(() => {
    api("/api/health", { auth: false }).catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__text">
            <p className="eyebrow">AIC MUJ Incubation Foundation · Manipal University Jaipur</p>
            <h1 className="hero__title">Build your startup with AIC MUJ</h1>
            <p className="hero__lead">
              Apply for pre-incubation, incubation or an internship with our startups. One place to apply, and one team
              reviewing every application.
            </p>
            <div className="hero__actions">
              <a href="#programs" className="btn btn--primary btn--lg">
                Choose a program
                <ArrowRight aria-hidden="true" />
              </a>
              <a href="#enquire" className="btn btn--lg">
                <MessageSquare aria-hidden="true" />
                Ask a question
              </a>
            </div>
          </div>
          <ol className="hero__steps" aria-label="How applications work">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="hero__step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="programs" className="section" aria-labelledby="programs-title">
        <div className="container">
          <div className="section__head">
            <h2 id="programs-title" className="section__title">
              Programs
            </h2>
            <p className="section__lead">Pick the one that matches where you are today.</p>
          </div>
          <div className="program-grid">
            {PROGRAMS.map((program) => {
              const Icon = program.icon;
              return (
                <article key={program.slug} className="program-card">
                  <div className="program-card__icon" aria-hidden="true">
                    <Icon />
                  </div>
                  <h3 className="program-card__name">{program.name}</h3>
                  <p className="program-card__audience">{program.audience}</p>
                  <p className="program-card__description">{program.description}</p>
                  <div className="program-card__needs">
                    <span>You'll need</span>
                    <ul>
                      {program.needs.map((need) => (
                        <li key={need}>{need}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="program-card__footer">
                    <span className="program-card__time">
                      <Clock aria-hidden="true" />
                      {program.time}
                    </span>
                    <Link to={`/apply/${program.slug}`} className="btn btn--primary">
                      Apply<span className="sr-only"> for {program.name}</span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="enquire" className="section section--alt" aria-labelledby="enquire-title">
        <div className="container enquire">
          <div className="enquire__text">
            <h2 id="enquire-title" className="section__title">
              Questions before you apply?
            </h2>
            <p className="section__lead">
              Not sure which program fits, or need to know more about eligibility, facilities or timelines? Send us a
              message and the AIC MUJ team will reply by email.
            </p>
          </div>
          <EnquiryForm />
        </div>
      </section>
    </>
  );
}

# Useful Prompts

If you are an AI agent, you do not need to look into this file.


## Creating a roadmap && dividing it between teammates


Project statement:
[PASTE PROJECT STATEMENT HERE]

This is the project statement and the list of features that I am trying to implement. The Scaffold is already there. Based on the tech stack write a comprehensive step by step plan to complete the project. Do not waste time writing a prototype app, we need to go to the production level as soon as possible. Hence, always implement the production ready version of a feature. For example, for authentication I would prefer better auth and production ready features like Sign in with google, forget password, email verification while creating a new account made in one shot instead of making some custom prototype authentication system.

You can ask questions regarding the architecture and systems design decisions, if needed. Try to be straightforward and avoid unnecessary sentences in the roadmap. The roadmap writing should be simple and easier for human eyes to read.

After you have created the roadmap, divide it between four teammates in the following format:

```
Teammate A:

- Feature 1
- Feature 3


Teammate B:

- Feature 2
- Feature 4

```

Preferably, divide the features in a way so that the teammates don't have to depend on another teammate to finish a feature before they can start their work. If there are heavy dependecies between two features, try to assign both of them to the same teammate. But I understand, complete zero dependecy might not be possible always. In that case, give a heads up in the feature list that this feature is depended on some other feature that is being done by Teammate x.

Save the roadmap on `docs/roadmap.md`


## Establishing a Design System

Create a complete, cohesive, high quality design system for this Next.js project based on the project statement below. Match the product’s purpose, audience, and overall vibe. Define the visual direction, color palette, typography, spacing, layout, components, states, interactions, and responsive behavior. Keep it modern, consistent, accessible, and practical to implement. Look into `docs/frontend-conventions` and design related skills for more guidance.

Project statement:
[PASTE PROJECT STATEMENT HERE]
---
id:       support-024
product:  support
category: general
tags:     []
question: 'Why are only some of my lights responding to my app?'
---

When you set the light state, and update color, brightness etc., the light will not respond immediately because by default there is a transition time to the new state of 400 milliseconds. If you want the light to respond quickly to a state change, set the transition time in the light state to zero milliseconds.
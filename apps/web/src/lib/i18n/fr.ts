export const fr = {
  redeem: {
    title: "D\u00e9bloquer une qu\u00eate",
    intro: "Entrez votre code pour d\u00e9bloquer votre qu\u00eate.",
    inputPlaceholder: "Votre code",
    submit: "D\u00e9bloquer",
    invalidCode: "Code invalide",
    notReady:
      "Votre achat est encore en cours de finalisation. R\u00e9essayez dans quelques instants.",
    loading: "Chargement...",
    redirecting: "Ouverture de votre qu\u00eate...",
    success: "Qu\u00eate d\u00e9bloqu\u00e9e",
  },

  checkoutSuccess: {
    title: "Paiement confirm\u00e9",
    intro: "Merci pour votre achat.",
    emailNotice:
      "Votre code de d\u00e9blocage appara\u00eetra ici et vous sera aussi envoy\u00e9 par email.",
    missingSession:
      "Impossible de r\u00e9cup\u00e9rer la session de paiement. Si le paiement a \u00e9t\u00e9 effectu\u00e9, contactez-nous avec votre r\u00e9f\u00e9rence de commande.",
    loading: "V\u00e9rification de votre paiement...",
    processingDelay:
      "Votre paiement est confirm\u00e9. Nous finalisons votre code de d\u00e9blocage. Cette page se met \u00e0 jour automatiquement.",
    codeLabel: "Votre code :",
    codeVisibleNotice:
      "Conservez ce code. Vous pouvez l'utiliser tout de suite, m\u00eame si l'email prend un peu plus de temps.",
    referenceLabel: "R\u00e9f\u00e9rence de commande :",
    redeemCta: "D\u00e9bloquer ma qu\u00eate",
    supportHint:
      "En cas de probl\u00e8me, contactez-nous en indiquant cette r\u00e9f\u00e9rence.",
    invalidApiResponse: "L'API n'a pas renvoy\u00e9 de r\u00e9ponse JSON valide.",
    fetchError: "Impossible de r\u00e9cup\u00e9rer le statut de la commande.",
    genericError: "Une erreur est survenue.",
  },

  home: {},

  quests: {
    title: "Qu\u00eates",
    intro:
      "D\u00e9couvrez nos aventures et choisissez votre prochaine qu\u00eate.",
    notFound: "Qu\u00eate introuvable",
    resumeCta: "Reprendre cette qu\u00eate",
    devBypassCta: "D\u00e9bloquer en mode dev",
    unlockedListCta: "Voir mes qu\u00eates d\u00e9bloqu\u00e9es",
    unlockedSectionTitle: "Mes qu\u00eates d\u00e9bloqu\u00e9es",
    unlockedSectionBody:
      "Retrouvez ici les qu\u00eates d\u00e9j\u00e0 disponibles sur cet appareil et reprenez votre progression en un geste.",
    storeSectionTitle: "Boutique des qu\u00eates",
    storeSectionBody:
      "Explorez les aventures disponibles et choisissez votre prochaine sortie.",
    currentStepLabel: "\u00c9tape",
    completedStepsLabel: "\u00e9tape(s) valid\u00e9e(s)",
    emptyUnlocked: "Aucune qu\u00eate n'est encore d\u00e9bloqu\u00e9e sur cet appareil.",
    reviewCompletedCta: "Voir le r\u00e9capitulatif",
    redeemCta: "J'ai un code",
  },

  purchase: {
    redirecting: "Redirection...",
    startError: "Impossible de d\u00e9marrer le paiement.",
    buyCtaPrefix: "Acheter cette qu\u00eate - CHF",
  },

  play: {
    unlockedEyebrow: "Qu\u00eate d\u00e9bloqu\u00e9e",
    currentStepLabel: "\u00c9tape actuelle",
    completedTitle: "Bravo, qu\u00eate termin\u00e9e !",
    completedBody:
      "Vous avez men\u00e9 cette aventure jusqu'au bout. Votre progression reste accessible sur cet appareil tant que vous ne retirez pas la qu\u00eate.",
    completedDurationLabel: "Temps total",
    completedPrimaryCta: "Explorer d'autres qu\u00eates",
    shareCta: "Partager mon r\u00e9sultat",
    shareSuccess: "Le lien de la qu\u00eate a \u00e9t\u00e9 copi\u00e9.",
    shareError: "Impossible de partager ce r\u00e9sultat pour le moment.",
    durationLessThanMinute: "moins d'une minute",
    resumeTitle: "Reprendre votre aventure",
    resumeBody:
      "Votre progression est enregistr\u00e9e c\u00f4t\u00e9 serveur et vous pouvez reprendre ici \u00e0 tout moment sur cet appareil.",
    completedStepsLabel: "\u00c9tapes termin\u00e9es",
    startCta: "Commencer l'aventure",
    resumeCta: "Reprendre l'aventure",
    launching: "Ouverture de la qu\u00eate...",
    deviceTitle: "Sur cet appareil",
    deviceBody:
      "Si vous utilisez un appareil partag\u00e9, utilisez le bouton ci-dessous pour retirer cette qu\u00eate une fois votre partie termin\u00e9e.",
    deviceRecoveryBody:
      "En cas d'absence prolong\u00e9e ou si les donn\u00e9es locales sont effac\u00e9es, vous pourrez r\u00e9cup\u00e9rer l'acc\u00e8s avec votre code.",
    restartWarning:
      "Vous pouvez reprendre cette qu\u00eate, mais l'\u00e9tape en cours doit \u00eatre recommenc\u00e9e car elle est rest\u00e9e inactive pendant plus de 30 jours.",
  },

  step: {
    titlePrefix: "\u00c9tape",
    defaultPrompt:
      "R\u00e9solvez l'\u00e9nigme et validez votre r\u00e9ponse sur place.",
    hintLabel: "Indice",
    answerLabel: "Votre r\u00e9ponse",
    answerPlaceholder: "Entrez votre r\u00e9ponse",
    validateButton: "Valider cette \u00e9tape",
    validating: "Validation...",
    checkingLocation: "V\u00e9rification de votre position...",
    validatingStep: "Validation de l'\u00e9tape...",
    progressing: "Ouverture de la suite...",
    tooFar: "Vous n'\u00eates pas encore assez pr\u00e8s du point.",
    wrongAnswer: "La r\u00e9ponse n'est pas correcte.",
    notUnlocked: "\u00c9tape non valid\u00e9e.",
    unsupportedPuzzle:
      "Ce type d'\u00e9nigme n'est pas encore pris en charge dans ce flux.",
    genericError: "Impossible de valider cette \u00e9tape.",
  },

  forgetDevice: {
    confirm:
      "Retirer cette qu\u00eate de cet appareil ? Vous pourrez la r\u00e9cup\u00e9rer plus tard avec votre code.",
    loading: "Retrait en cours...",
    button: "Retirer cette qu\u00eate de cet appareil",
    genericError: "Impossible de retirer cette qu\u00eate de cet appareil.",
    modalTitle: "Retirer cette qu\u00eate ?",
    modalBody:
      "Cette qu\u00eate sera retir\u00e9e de cet appareil. Vous pourrez la r\u00e9cup\u00e9rer plus tard avec votre code.",
    cancel: "Annuler",
    confirmButton: "Confirmer le retrait",
  },

  theme: {
    toggleLabel: "Changer de th\u00e8me",
  },

  storageNotice: {
    title: "Stockage n\u00e9cessaire au fonctionnement",
    body:
      "GeoQuest utilise un cookie de session strictement n\u00e9cessaire pour garder vos qu\u00eates accessibles sur cet appareil, ainsi qu'un stockage local pour votre r\u00e9ponse en cours et votre pr\u00e9f\u00e9rence de th\u00e8me. Votre position est contr\u00f4l\u00e9e pendant la validation des \u00e9tapes, mais elle n'est pas enregistr\u00e9e c\u00f4t\u00e9 serveur dans ce flux.",
    dismiss: "Compris",
  },

  api: {
    invalidOrigin: "Origine de la requ\u00eate invalide.",
    missingCode: "Code manquant.",
    tooManyRedeemAttempts:
      "Trop de tentatives de d\u00e9blocage. Veuillez r\u00e9essayer plus tard.",
    tooManySubmissions:
      "Trop de validations d'\u00e9tape. Veuillez r\u00e9essayer dans un instant.",
    missingQuestAccess:
      "Vous devez d'abord d\u00e9bloquer cette qu\u00eate sur cet appareil.",
    unknownQuestAccess: "Acc\u00e8s \u00e0 la qu\u00eate introuvable pour cet appareil.",
    unknownStep: "\u00c9tape introuvable.",
    staleProgress:
      "Votre progression a chang\u00e9. Rechargez la page et r\u00e9essayez.",
    wrongCurrentStep:
      "Cette \u00e9tape n'est plus l'\u00e9tape active de votre qu\u00eate.",
    invalidPayload: "Requ\u00eate invalide.",
    genericStepError: "Impossible de valider cette \u00e9tape.",
  },
} as const;

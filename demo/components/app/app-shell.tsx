"use client"

import { useEffect } from "react"
import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react"
import { motion } from "motion/react"

import { Board } from "@/components/app/board"
import { SiteHeader } from "@/components/app/site-header"
import { Workspace } from "@/components/app/workspace"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { useData } from "@/lib/data"
import { useAppStore } from "@/lib/store"

function Loading() {
  return (
    <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground" role="status">
      <span className="flex items-center gap-2">
        <motion.span
          className="inline-flex"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}
        >
          <LoaderCircleIcon className="size-4" />
        </motion.span>
        Loading programmes
      </span>
    </div>
  )
}

function LoadError() {
  const retry = () => {
    useData.setState({ status: "idle" })
    useData.getState().load()
  }
  return (
    <Empty className="m-4 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>The programme list didn’t load</EmptyTitle>
        <EmptyDescription>Check the connection, then try again.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function SiteFooter() {
  const fx = useData((s) => s.data?.fx)
  return (
    <footer className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground lg:px-4">
      <p>
        Admitted-student figures aggregate published admission reports: they describe past admits, not
        anyone’s chances.{fx && ` Tuition is approximate, in S$ at MAS ${fx.period} rates.`} Your
        shortlist and board stay in this browser.
      </p>
      <p>
        How AI is used: Claude (Anthropic) read official university pages for programme details and
        matched reported cases to programmes, and each value was checked against its source. Nothing
        you do here is sent to an AI.
      </p>
    </footer>
  )
}

export function AppShell() {
  const status = useData((s) => s.status)
  const hydrated = useAppStore((s) => s.hydrated)
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)

  useEffect(() => {
    void useAppStore.persist.rehydrate()
    useData.getState().load()
  }, [])

  const ready = hydrated && status === "ready"

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value === "board" ? "board" : "workspace")}
      className="min-h-dvh gap-0 lg:h-dvh"
    >
      <SiteHeader />
      <div className="flex min-h-0 flex-1 flex-col">
        {status === "error" ? (
          <LoadError />
        ) : !ready ? (
          <Loading />
        ) : (
          <>
            <TabsContent value="workspace" className="flex min-h-0 flex-col">
              <Workspace />
            </TabsContent>
            <TabsContent value="board" className="flex min-h-0 flex-col">
              <Board />
            </TabsContent>
          </>
        )}
      </div>
      <SiteFooter />
    </Tabs>
  )
}

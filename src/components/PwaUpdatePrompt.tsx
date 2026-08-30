import { useState, useSyncExternalStore } from 'react'
import { Alert, Button, Snackbar } from '@mui/material'
import {
  applyAppUpdate,
  getAppUpdateAvailable,
  subscribeToAppUpdate,
} from '../offline'

export function PwaUpdatePrompt() {
  const updateAvailable = useSyncExternalStore(
    subscribeToAppUpdate,
    getAppUpdateAvailable,
    () => false,
  )
  const [updating, setUpdating] = useState(false)

  return (
    <Snackbar
      open={updateAvailable}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 88, sm: 96 } }}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{ width: '100%', borderRadius: 2, alignItems: 'center' }}
        action={
          <Button
            color="inherit"
            size="small"
            disabled={updating}
            onClick={async () => {
              setUpdating(true)
              try {
                await applyAppUpdate()
              } finally {
                setUpdating(false)
              }
            }}
          >
            {updating ? '更新中…' : '更新する'}
          </Button>
        }
      >
        新しいバージョンがあります
      </Alert>
    </Snackbar>
  )
}

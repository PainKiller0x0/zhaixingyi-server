@echo off
setlocal enabledelayedexpansion
chcp 65001
title 一键部署后端代码脚本 (稳定版)

set REMOTE_NAME=origin
set REMOTE_BRANCH=master
set SERVER_USER=root
set SERVER_IP=8.134.192.197
set SERVER_PATH=/opt/zhaixingyi-backend
set PM2_APP_NAME=zhaixingyi-api

echo ====================================
echo Git 一键部署后端代码脚本 (稳定版)
echo ====================================
echo.

:: 检查当前目录是否是Git仓库
if not exist ".git" (
    echo ❌ 错误：当前目录不是一个Git仓库，请在正确的目录运行此脚本。
    goto :end
)

echo.
echo ====================================
echo (1/3) 正在执行本地 Git 操作...
echo ====================================

:: 检查是否有未提交的更改
git diff-index --quiet HEAD --
if errorlevel 1 (
    set /p commit_message="请输入本次提交的描述信息: "
    if "!commit_message!"=="" (
        echo ⚠️ 警告：提交信息不能为空。
        goto :end
    )

    git add .
    if errorlevel 1 (
        echo ❌ 错误：git add 失败。
        goto :end
    )

    git commit -m "!commit_message!"
    if errorlevel 1 (
        echo ❌ 错误：git commit 失败。
        goto :end
    )

    git push %REMOTE_NAME% %REMOTE_BRANCH%
    if errorlevel 1 (
        echo ❌ 错误：git push 失败，请检查网络连接或仓库配置。
        goto :end
    )
) else (
    echo ℹ️ 没有需要提交的更改，跳过提交和推送步骤。
)

echo.
echo ====================================
echo (2/3) 本地操作完成，开始远程部署...
echo ====================================

ssh %SERVER_USER%@%SERVER_IP% "cd %SERVER_PATH% && git pull %REMOTE_NAME% %REMOTE_BRANCH% && pm2 restart %PM2_APP_NAME%"
if errorlevel 1 (
    echo ❌ 错误：远程部署失败，请检查SSH连接、Git、PM2状态。
    goto :end
)

echo.
echo ====================================
echo (3/3) 部署成功！🚀
echo ====================================

:end
echo.
pause
